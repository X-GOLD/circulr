import React from 'react'
import {Containers} from 'modules'
import UiContianers from 'LoopringUI/containers'
import Setting from './Setting'
import GasFee from './GasFee'
function Modals(props) {
  return (
    <div>
      <Containers.Layers id="setting">
        <UiContianers.Panels id="setting" position="right" width="30vw">
          <Setting />
        </UiContianers.Panels>
      </Containers.Layers>
      <Containers.Layers id="gasFee">
        <UiContianers.Panels id="gasFee" position="right">
          <GasFee />
        </UiContianers.Panels>
      </Containers.Layers>

    </div>
  )
}
export default Modals
