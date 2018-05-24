import React from 'react'
import {Containers} from 'modules'
import UiContianers from 'LoopringUI/containers'
import Receive from './Receive'
import Transfer from './TransferForm'
import Convert from './ConvertForm'
import TransferConfirm from './TransferConfirm'

function Modals(props) {
  return (
    <div>
      <Containers.Modals id="receiveToken">
        <Containers.Sockets id="balance">
        <UiContianers.Modals id="receiveToken">
          <Receive/>
        </UiContianers.Modals>
        </Containers.Sockets>
      </Containers.Modals>
      <Containers.Modals id="transferToken">
        <UiContianers.Modals id="transferToken">
          <Containers.Sockets id="balance">
            <Containers.Sockets id="marketcap">
              <Containers.Wallet>
                <Containers.Transfer initState={{}}>
                  <Containers.Modals>
                    <Containers.Gas>
                      <Transfer />
                    </Containers.Gas>
                  </Containers.Modals>
                </Containers.Transfer>
              </Containers.Wallet>
            </Containers.Sockets>
          </Containers.Sockets>
        </UiContianers.Modals>
      </Containers.Modals>
      <Containers.Modals id="transferConfirm">
        <UiContianers.Modals id="transferConfirm">
          <Containers.Sockets id="marketcap">
            <Containers.Wallet>
              <Containers.Modals>
                <Containers.Settings>
                  <TransferConfirm />
                </Containers.Settings>
              </Containers.Modals>
            </Containers.Wallet>
          </Containers.Sockets>
        </UiContianers.Modals>
      </Containers.Modals>
      <Containers.Modals id="convertToken" >
        <UiContianers.Modals id="convertToken">
              <Containers.Wallet>
                <Containers.Convert >
                  <Convert/>
                </Containers.Convert>
              </Containers.Wallet>
        </UiContianers.Modals>
      </Containers.Modals>
    </div>
  )
}
export default Modals
