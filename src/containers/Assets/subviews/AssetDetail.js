import React,{PureComponent} from 'react'
import { Row, Col, Button, Tag, Modal, Input } from 'antd';
import BTFetch from '../../../utils/BTFetch'
import { getBlockInfo, getSignaturedFetchParam } from '../../../utils/BTCommonApi'
import {FormattedMessage} from 'react-intl'
import messages from '../../../locales/messages'
import {getAccount} from '../../../tools/localStore'
import { getDateAndTime } from '@/utils/dateTimeFormat'
import BTFavoriteStar from '@/components/BTFavoriteStar'
import { BTDownloadFile } from '@/utils/BTDownloadFile'
import CloseBack from '@/components/CloseBack'
import BTTags from '../../AssetAndRequirement/BTTags'
import { PackArraySize, PackStr16 } from '@/lib/msgpack/msgpack'

import { arTypeKeyMap } from '@/utils/keyMaps'

const AssetMessages = messages.Asset;
// 此处样式在Demand/subviews/styles.less中控制
const { TextArea } = Input;
const confirm = Modal.confirm;

export default class BTAssetDetail extends PureComponent{
    constructor(props) {
        super(props)
        this.state = {
            ...this.props.location.state,
            visible: false
        }
    }
    handleCancel(e) {
        this.setState({
            visible: false,
        });
    }

    showModal(e) {
      if (!getAccount()){
          message.warning(window.localeInfo["Asset.PleaseLogInFirst"])
          return;
      }
      this.setState({
        visible: true,
      });
    }

    async buySureAsset() {

      let originParam = {
      	"data_deal_id": window.uuid(),
      	"basic_info": {
      		"username": getAccount().username,
      		"assetId": this.state.asset_id
      	}
      }

      let b1 = PackArraySize(2)
      let b2 = PackStr16(originParam.data_deal_id)

      let b3 = PackArraySize(2)

      let b4 = PackStr16(originParam.basic_info.username)
      let b5 = PackStr16(originParam.basic_info.assetId)

      let param = [...b1,...b2,...b3,...b4,...b5]

      //获取区块信息
      let blockInfo = await getBlockInfo()

      let fetchParam = {
        "version": 1,
        ...blockInfo,
        "sender": getAccount().username,
        "contract": "datadealmng",
        "method": "buydata",
        "param": param,
        "sig_alg": 1
      }

      let privateKey = Buffer.from(getAccount().privateKey, 'hex')

      BTFetch('/exchange/buyAsset', 'post', getSignaturedFetchParam({fetchParam, privateKey}))
      .then(res=>{
        if (!res) {
          throw new Error('buy asset failed')
        }
        // console.log(res);
        if (res.code == 1) {
          this.setState({ isBuy_asset_flag: true })
          window.message.success(window.localeInfo["Asset.SuccessfulPurchase"])
        } else if (res.code == 4001) {
          message.warning(window.localeInfo["Asset.InsufficientBalance"])
        }
      }).catch(err => {
        console.error('err', err);
        window.message.error(window.localeInfo["Asset.FailedPurchase"])
      })
    }

    async handleOk(){
      this.setState({
        visible: false,
      });
      message.destroy();

      if (this.state.username == getAccount().username) {
        message.warning(window.localeInfo["Asset.YouAreNotAllowedToBuyYourOwnAssets"])
        return;
      }
      //查询是否已购买资产
      // "asset_id":this.state.data.asset_id,

      this.buySureAsset()
    }

    download(sample_hash) {
      let { sample_hash: guid, asset_name: filename, username } = this.props.location.state;

      BTDownloadFile(guid, filename, username)
    }

    render() {

      let data = this.state;
      let time = new Date((data.expire_time)*1000).toLocaleDateString();
      let tagsArr = data.feature_tag.split('-')

        return (
          <div className='route-children-container route-children-bg'>
            <CloseBack />
            <div className="assetDetailBox">
              <h2 className='route-children-container-title'>
                <FormattedMessage {...AssetMessages.DataDetails}/>
              </h2>
              <div className="mainData">
                <div className="headAndShop">
                  <h1>{data.asset_name}</h1>
                  <BTFavoriteStar isFavorite={data.favorite_flag} type='asset' id={data.asset_id} />
                </div>

                <Row>
                  <Col span={4}>
                    <FormattedMessage {...AssetMessages.AssetID}/>
                  </Col>
                  <Col span={18}>{data.asset_id}</Col>
                </Row>

                <Row>
                  <Col span={4}>
                    <FormattedMessage {...AssetMessages.Publisher}/>
                  </Col>
                  <Col span={18}>{data.username}</Col>
                </Row>

                <Row>
                  <Col span={4}>
                    <FormattedMessage {...AssetMessages.AssetType}/>
                  </Col>
                  <Col span={18}>
                    {arTypeKeyMap[data.asset_type]}
                  </Col>
                </Row>

                <Row>
                  <Col span={4}>
                    <FormattedMessage {...AssetMessages.ExpectedPrice}/>
                  </Col>
                  <Col span={18}>
                    {data.price / Math.pow(10, 8)}
                    <img src='./img/token.png' width='15' style={{marginLeft:6}} />
                  </Col>
                </Row>

                <Row>
                  <Col span={4}>
                    <FormattedMessage {...AssetMessages.ExpireTime}/>
                  </Col>
                  <Col span={18}>{getDateAndTime(time)}</Col>
                </Row>

                <Row>
                  <Col span={4}>
                    <FormattedMessage {...AssetMessages.FeatureTag}/>
                  </Col>
                  <Col span={18}>
                    <BTTags tags={tagsArr} />
                  </Col>
                </Row>

              </div>

              <ul>
                  <li>
                    {data.isBuy_asset_flag ?
                      <Button disabled>
                        <FormattedMessage {...AssetMessages.HaveBought}/>
                      </Button>
                      :
                      <Button onClick={()=>this.showModal()} type="primary">
                        <FormattedMessage {...AssetMessages.BuyAssets}/>
                      </Button>
                    }
                  </li>
                  <li>
                      <Button onClick={()=>this.download()} type="primary">
                          <FormattedMessage {...AssetMessages.DownLoadTheSample}/>
                      </Button>
                  </li>
              </ul>

              <Modal
                visible={this.state.visible}
                onOk={(e)=>this.handleOk(e)}
                onCancel={(e)=>this.handleCancel(e)}
              >
                <p>
                  <FormattedMessage {...AssetMessages.AreYouSureToBuyThisAsset}/>
                </p>
              </Modal>

              <div className="dataDescription">
                <span>
                  <FormattedMessage {...AssetMessages.DataDescription}/>
                </span>
                <TextArea readOnly rows={4} defaultValue={data.description} />
              </div>
            </div>
          </div>
        )
    }
}
