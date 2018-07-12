/*
  Copyright 2017~2022 The Bottos Authors
  This file is part of the Bottos Data Exchange Client
  Created by Developers Team of Bottos.

  This program is free software: you can distribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with Bottos. If not, see <http://www.gnu.org/licenses/>.
*/
import React, { Component, PureComponent } from 'react'
import { connect } from 'react-redux'
import { setSpin } from '@/redux/actions/HeaderAction'
import { Form, Spin, Icon, Input, Button, Row, Col ,Tooltip} from 'antd'
import BTFetch from '@/utils/BTFetch'
import BTCryptTool from 'bottos-crypto-js'
import '../styles.less'
import BTIpcRenderer from '@/tools/BTIpcRenderer'
import {exportFile} from '@/utils/BTUtil'
import {FormattedMessage} from 'react-intl'
import {isUserName} from '@/tools/BTCheck'
import ConfirmButton from '../ConfirmButton'
import messages from '@/locales/messages'
import {messageProtoEncode} from '@/lib/proto/index'
import {getBlockInfo} from '@/utils/BTCommonApi'
import { getWorker } from '@/workerManage'
import { packedParam } from '../../utils/pack'

const msgpack = require('@/lib/msgpack/msgpack')

const HeaderMessages = messages.Header;
const LoginMessages = messages.Login;
const FormItem = Form.Item;
const TextArea = Input.TextArea
const Keystore = BTCryptTool.keystore

function BTRegistSuccess({username, keystoreObj}) {
  let cryptStr = JSON.stringify(keystoreObj)
  function copyToClipboard() {
    const clipboard = window.electron.clipboard
    // console.log(clipboard.readText())
    clipboard.writeText(cryptStr)
    // console.log(clipboard.readText())
  }

  function downloadKeystore() {
    BTIpcRenderer.exportKeyStore(username, keystoreObj);
  }

  return (
    <div className='register' style={{textAlign: 'center'}}>
      <p className='route-children-container-title' style={{margin: '20px auto'}}>
        <FormattedMessage {...HeaderMessages.YourAccountHasBeenRegisteredSuccessfully}/>
      </p>

      <div style={{margin: '15px 5%'}}>
        <TextArea rows={8} readOnly defaultValue={cryptStr} />
      </div>

      <p><FormattedMessage {...LoginMessages.AutoBackup} /></p>

      <Row type='flex' justify='space-around' style={{marginTop: 20}}>
        <Button type='primary' onClick={copyToClipboard}>
          <FormattedMessage {...HeaderMessages.CopyYourKetstore}/>
        </Button>

        <Button type='primary' onClick={downloadKeystore}>
          <FormattedMessage {...HeaderMessages.BackupYourKeystore}/>
        </Button>
      </Row>

    </div>
  )
}


const formItemLayout = {
    labelCol: {
        xs: { span: 24 },
        sm: { span: 8 },
    },
    wrapperCol: {
        xs: { span: 24 },
        sm: { span: 16 },
    },
};

class Regist extends PureComponent{
    constructor(props){
        super(props);
        this.state = {
            user_type: 0,
            isRegistered: false,
            // 下面两个是 BTRegistSuccess 需要的参数
            username: '',
            keystoreObj: {}
        }

        this.onHandleSubmit = this.onHandleSubmit.bind(this)
    }

    registSuccess({keystoreObj, username}) {
        this.setState({
            isRegistered: true,
            keystoreObj,
            username
        })
    }

    clearFields = () => {
        const {setFieldsValue} = this.props.form;

        setFieldsValue({
            username:'',
            password:'',
            newpassword:'',
            email:'',
            verificationCode:''
        })
    }

    async onHandleSubmit(e) {
        // console.log("onHandleSubmit")
        e.preventDefault()
        message.destroy();
        const { getFieldsValue } = this.props.form;
        let fieldValues = getFieldsValue()
        // 获取表单参数
        let username = fieldValues.username;

        // 检查username
        if(!isUserName(username)) {message.error(window.localeInfo["Header.UserNameIsNotRight"]);return}

        // let role_type = fieldValues.role_type;
        let email = fieldValues.email;
        let password = fieldValues.password;
        let surePassword = fieldValues.newpassword;
        let verificationCode = fieldValues.verificationCode;
        //新增参数
        let msg = fieldValues.msg;
        let phone = fieldValues.phone;
        let contacts = fieldValues.contacts;
        let contactsPhone = fieldValues.contactsPhone;

        // !(new RegExp(/^{8,}$/, "g").test(password))
        if(username==undefined){message.error(window.localeInfo["Header.PleaseEnterTheUserName"]); return}
        if(password==undefined){message.error(window.localeInfo["Header.PleaseEnterThePassword"]); return}
        else if(password.length < 8){
            message.error(window.localeInfo["Header.ThePasswordShouldContainAtLeast8BitCharacters"]);
            return;
        }
        if(password != surePassword){
            message.error(window.localeInfo["Header.IncorrectPasswordEnteredTwice"]);
            return;
        }

        // 判断验证码
        if(verificationCode==undefined){message.error(window.localeInfo["Header.PleaseEnterTheVerificationCode"]); return}

        this.props.setSpin(true)

        let keys = BTCryptTool.createPubPrivateKeys()
        let privateKey = keys.privateKey
        let blockHeader = await getBlockInfo()

        // console.log('注册', blockHeader);

        // if(!(blockHeader && blockHeader.code==1)){
        //     message.error(window.localeInfo["Header.FailedRegister"]);
        //     return
        // }

        // console.log('注册');
        // did
        let didParam = this.getDid(username, keys)

        // let arrSize = msgpack.PackArraySize(2)
        // let arrid = msgpack.PackStr16(didParam.didid)
        // let arrStr = msgpack.PackStr16(didParam.info)
        // let buf = [...arrSize,...arrid,...arrStr]

        let newuser = {
            version:1,
            ...blockHeader,
            sender: username,
            contract:"usermng",
            method:"reguser",
            // param: buf,
            sig_alg:1
        }

        newuser = await packedParam(didParam, newuser, privateKey)
        console.log('newuser', newuser);

        console.assert( newuser.param === param, '不相等', param, newuser.param)

        let registParams = {
            account:{
                Name:username,
                Pubkey:keys.publicKey.toString('hex')
            },
            user:newuser,
            verify_id:this.props.verify_id,
            verify_value:verificationCode
        }

        let registUrl = '/user/register'
        BTFetch(registUrl,'POST',registParams)
        .then(response => {
          if (!response) {
            message.error(window.localeInfo["Header.FailedRegister"]);
            this.props.setSpin(false)
            return
          }
          console.log('response', response);
          console.log('response.code', response.code);
          if (response.code == 1) {

            let postData = {
              type: 'createKeystore',
              data: {account:username,password,privateKey}
            }

            var myWorker = getWorker()
            myWorker.postMessage(postData);

            myWorker.onmessage = (e) => {
              console.log('Message received from worker', e.data);
              let keystoreObj = e.data
              // 创建本地用户目录
              BTIpcRenderer.mkdir(username)
              // 存储keystore文件到本地
              let isSaveSuccess = BTIpcRenderer.saveKeyStore({username:username,account_name:username},keystoreObj)
              isSaveSuccess ? message.success('keystore saved success') : message.error('keystore saved faild')
              this.registSuccess({username, keystoreObj})
              this.clearFields()
              this.props.setSpin(false)
              this.props.requestVerificationCode()
              message.success(window.localeInfo["Header.YourRegistrationHasBeenSuccessfullyCompleted"]);
            }

            myWorker.onerror = (e) => {
              console.error('worker error', e);
              window.message.error(window.localeInfo["Header.FailedRegister"]);
              this.props.setSpin(false)
            }

          }else if(response.code == 1001){
            this.props.setSpin(false)
            this.props.requestVerificationCode()
            message.warning(window.localeInfo["Header.VerificationCodeWrong"]);

          }else if(response.code == 1004){
            console.log('response.code', response.code);
            this.props.setSpin(false)
            console.log('details', JSON.parse(res.details));
            this.props.requestVerificationCode()
            message.error(window.localeInfo["Header.AccountHasAlreadyExisted"]);
          }else{
            this.props.setSpin(false)
            console.log('details', JSON.parse(res.details));
            this.props.requestVerificationCode()
            message.error(window.localeInfo["Header.FailedRegister"]);
          }

        }).catch(error=>{
          this.props.setSpin(false)
          message.error(window.localeInfo["Header.FailedRegister"]);
        })
    }

    getDid(accountName,keys){
        let publicKey = keys.publicKey
        let privateKey = keys.privateKey
        let publicKeyStr = publicKey.toString('hex')
        let didid = "did:bot:"+publicKeyStr.slice(0,32)
        let didParam = {
            didid, // account公钥截取前32位
            info: {
                "@context": "https://bottos.org/did/v1",
                "nameBase58": accountName,  // 当前用户名
                "version": "0.1",
                "botid": didid,  // didid
                "account": [{
                    "nameBase58": accountName,
                    "role": "owner",
                    "expires": new Date().getTime()+30*24*60*60,
                    "publicKey": publicKeyStr
                }],
                "control": [{
                    "type": "OrControl",
                    "controller": [{
                        "botid": didid,
                        "type": "EcdsaVerificationKey2018",
                        "owner": didid,  // 当前用户自己
                        "publicKey": publicKeyStr
                    }]
                }],
                "service": {

                },
                "created": new Date().getTime(),
                "updated": new Date().getTime()
            }
        }

        let hash = BTCryptTool.sha256(JSON.stringify(didParam))

        let signature = BTCryptTool.sign(hash,privateKey)
        didParam.info.signature = {
            "type": "EcdsaVerificationKey2018",
            "created": new Date().getTime(),
            "creator": didid,  // 谁签名写谁的
            "signatureValue": signature.toString('hex')
        }
        didParam.info = JSON.stringify(didParam.info)
        return didParam
    }

    handleRadioChange = (e) => {
        this.clearFields()
        this.setState({
            user_type: e.target.value,
        })
    }

    render() {
      if (this.state.isRegistered) {
        const {keystoreObj, username} = this.state
        return <BTRegistSuccess keystoreObj={keystoreObj} username={username} />
      }

        const { getFieldDecorator, getFieldsError, getFieldError, isFieldTouched } = this.props.form;

      return (

        <div className="register">
            <div className='route-children-container-title'><FormattedMessage {...HeaderMessages.Register}/></div>
            <Form style={{maxWidth: 560, paddingRight: '10%'}}>

              <FormItem {...formItemLayout} colon={false} label={<FormattedMessage {...LoginMessages.Account} />}>
                <Tooltip placement="topLeft" title={window.localeInfo["Header.AccountNameRequire"]}>
                  {
                      getFieldDecorator('username',{})(

                          <Input placeholder={window.localeInfo["Header.PleaseEnterTheUserName"]} id="error1" />

                      )
                  }
                </Tooltip>
              </FormItem>

              <FormItem {...formItemLayout} colon={false} label={<FormattedMessage {...LoginMessages.Password} />}>
                  {
                      getFieldDecorator('password',{})(
                          <Input placeholder={window.localeInfo["Header.PleaseEnterThePassword"]} type="password" id="error2" />
                      )
                  }
              </FormItem>
              <FormItem {...formItemLayout} colon={false} label={<FormattedMessage {...LoginMessages.ConfirmPassword} />}>
                  {
                      getFieldDecorator('newpassword',{})(
                          <Input placeholder={window.localeInfo["Header.PleaseEnterTheSurePassword"]} type="password" id="error1"/>
                      )
                  }
              </FormItem>

                {/* 这部分是验证码功能，先暂时隐藏起来 */}
                <FormItem {...formItemLayout} label={<FormattedMessage {...LoginMessages.VerifyCode} />}>
                  <Row gutter={8}>
                    <Col span={17}>
                      {
                        getFieldDecorator('verificationCode', {}) (
                          <Input placeholder={window.localeInfo["Header.PleaseEnterTheVerificationCode"]} id="error1"/>
                        )
                      }
                    </Col>
                    <Col span={7}>
                      {this.props.verify_data
                        ?
                        <img height='28px'
                          style={{marginBottom: 6, cursor: 'pointer'}}
                          onClick={this.props.requestVerificationCode}
                          src={this.props.verify_data} />
                        :
                        <Icon type='spin' />
                      }
                    </Col>
                  </Row>
                </FormItem>

            </Form>

            <div style={{textAlign: 'center'}}>
              <ConfirmButton onClick={this.onHandleSubmit} htmlType="submit">
                <FormattedMessage {...HeaderMessages.Register} />
              </ConfirmButton>
            </div>
        </div>
      )
    }
}

const RegistForm = Form.create()(Regist);

function mapStateToProps(state) {
  return {
    isloading: state.headerState.isloading
  };
}

function mapDispatchToProps(dispatch) {
  return {
    setSpin(isloading) {
      dispatch(setSpin(isloading))
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(RegistForm)
