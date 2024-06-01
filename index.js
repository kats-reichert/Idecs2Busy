const config =  require('./config.json')
const dgram = require('node:dgram');

const BusyLight = require('@pureit/busylight').BusyLight;
const devices = BusyLight.devices();

var radio_pei = [] 
var radio_ctl = [] 



// #################################################################################################################################
// Get all connected Busylights
// Note: Items added during runtime are actually not detected --- maybe later
//##################################################################################################################################

var busylights = [] // init array for all connected BusyLights
devices.forEach ((data, index) => { // now go trough all found busylights
    console.log("Found device with index: " + index + "\r\n SerialNumber: " + data.serialNumber + "\r\n Product: " + data.product ) // print it out
    console.log('======================================================================================================')
    busylights[index] = new BusyLight(devices[index]) // init the light
    busylights[index].connect() // connect to it
    busylights[index].light('000000') // switch off Light
    data.index = index // add index for easy accessing
  })


// #################################################################################################################################
// Get all in config defined Radios
// and set up the Multicast connections to these. Two Ports are in use. One for PEI Data and one for the "Selectric Data" (Control PTT etc)
//##################################################################################################################################
config.Radios.forEach ((data, index) => {
    console.log(data)
    radio_pei[index] = dgram.createSocket({ type: 'udp4', reuseAddr: true }) // Connect to each Radio defined in the config.json here: PEI interface at the given Port
    radio_pei[index].bind(data.RADIO_PORT_PEI, data.RADIO_MULTICAST, function(){ // use this line for LINUX
    //radio_pei[index].bind(data.RADIO_PORT_PEI, function(){ // use this line for WIN
        radio_pei[index].addMembership(data.RADIO_MULTICAST)
    })

    radio_pei[index].on('listening', function () { // start listening on Multicast Traffic
        let address = radio_pei[index].address()
        console.log('UDP radio_pei ' + index + ' is listening on ' + address.address + "@ " + data.RADIO_MULTICAST + ":" + address.port)
    })

    radio_pei[index].on('message', function (message, remote) { // add Event Handler for incomming Messages
        checkElement(message, index)
        //console.log('MCast Msg: From: ' + remote.address + ':' + remote.port +' - ' + index);
     })

     // Now get the Control Channel for the radio:
     radio_ctl[index] = dgram.createSocket({ type: 'udp4', reuseAddr: true }) // Connect to each Radio defined in the config.json here: Control interface at the given Port
     radio_ctl[index].bind(data.RADIO_PORT_CTL, data.RADIO_MULTICAST, function(){ // use this line for Linux
     //radio_ctl[index].bind(data.RADIO_PORT_CTL, function(){ // and this line for WIN
        radio_ctl[index].addMembership(data.RADIO_MULTICAST)
     })
 
     radio_ctl[index].on('listening', function () { // start listening on Multicast Traffic
         let address = radio_ctl[index].address();
         console.log('UDP radio_ctl ' + index + ' is listening on ' + address.address + "@ " + data.RADIO_MULTICAST + ":" + address.port);
     })
 
     radio_ctl[index].on('message', function (message, remote) { // add Event Handler for incomming Messages
      //  console.log('MCast Msg: From: ' + remote.address + ':' + remote.port +' - ' + message)
        let ctl_msg = '' // extract the Control message 
        ctl_msg = message.toString()
        ctl_msg = ctl_msg.replace('\r\n','')
        ctl_msg = ctl_msg.replace('\\','/')
        const regexp = /(<PTTACK>(.*?)<\/PTTACK>)/ // in this case for pressed PTT
        const matches = ctl_msg.match(regexp);
        if (matches != null){ // if there is a valid PTT message, 
            let dispatcherData = matches[2].split(',') // get the dispatcher Data
            let operation = dispatcherData[1] // get the operation 1== PTT Press, 2== PTT release
            let dispatcherName = dispatcherData[2] // get the Dispatcher Name
            let  found= config.Dispatchers.findIndex((element) => element.Name === dispatcherName) //look if the dispatcher is defined in the config.json
            if (operation === '1') { // if PTT is pressed, then set the TX Flag for this dispatcher to "true"
                if (config.Dispatchers[found] != undefined) { // check if the given dispatcher is really assigned in the config
                    config.Dispatchers[found].isTX = true
                }
            } else { // if not, then reset the TX Flag
                if (config.Dispatchers[found]!= undefined) {
                    config.Dispatchers[found].isTX = false
                }
            }
        } 
      })
})
// #################################################################################################################################
// Parse the PEI Messages
// and set the depending Busylights to the right color depending on the state
//##################################################################################################################################
function checkElement(element, Funkkreis) {
    let command = element.toString().split(':')
    if (command[0] === '+CTXG'){ 
      let kdo = command[1].split(',')
      if (kdo[1] === '3' || kdo[1] === '1' ) {
        console.log('Empfange....' + Funkkreis)
        let searchLights = config.BusyLights.filter((element) => element.RADIO === Funkkreis);
        searchLights.forEach ((data) => {
            let found = devices.find((element) => element.serialNumber === data.BL_SERIAL);
            if (found != undefined) {busylights[found.index].light('ff0000')}
        })
      } 
      if (kdo[1] === '0') { // someone is transmitting
        //console.log('Sende....' + Funkkreis)
        let searchLights = config.BusyLights.filter((element) => element.RADIO === Funkkreis) //get all busylights which are assinged to the Radio
        searchLights.forEach ((data) => {
            let found = devices.find((element) => element.serialNumber === data.BL_SERIAL) //get the busylights with serialNumber to adress the right one
            if (found != undefined ) { busylights[found.index].light('0044ff') } // set default color for TX Case
            data.DISPATCHERS.forEach ((data) => { // get all Dispatchers with set isTX flag
                if (config.Dispatchers[data].isTX === true) { // if there ist an Dispatcher with set flag - let this busylight light green
                    if (found != undefined ) {busylights[found.index].light('00ff00')}
                } 
            })         
        })

      } 
      if (kdo[1] === '2') {
        //console.log('waiting....' + Funkkreis) //someone wants to transmitt, but the call is granted to another radio
        let searchLights = config.BusyLights.filter((element) => element.RADIO === Funkkreis) //get all busylights which are assinged to the Radio
        searchLights.forEach ((data) => {
            let found = devices.find((element) => element.serialNumber === data.BL_SERIAL) //get the busylights with serialNumber to adress the right one
            if (found != undefined ) { busylights[found.index].blink('#0044ff',4,2) } // set default color for TX Case and let it blink 
            data.DISPATCHERS.forEach ((data) => {
                 if (config.Dispatchers[data].isTX === true) { // if there ist an Dispatcher with set flag - let this busylight blink green
                    if (found != undefined ) {busylights[found.index].blink('#00ff00',4,2) }
                 } 
             })
        })
      } 
    }
    if (command[0] === '+CDTXC'){ // Handler for Call ended
      //console.log("Gespräch ENDE" + Funkkreis)
      let searchLights = config.BusyLights.filter((element) => element.RADIO === Funkkreis) //get all busylights which are assinged to the Radio
        searchLights.forEach ((data) => {
            let found = devices.find((element) => element.serialNumber === data.BL_SERIAL) //get the busylights with serialNumber to adress the right one
            if (found != undefined) {busylights[found.index].light('ff4400')} // set all depending lights to yellow
        })
    }
    if (command[0] === '+CTCR'){ // Handler for group no more active
      //console.log("Gruppe ENDE" + Funkkreis)
      let searchLights = config.BusyLights.filter((element) => element.RADIO === Funkkreis) //get all busylights which are assinged to the Radio
      searchLights.forEach ((data) => {
          let found = devices.find((element) => element.serialNumber === data.BL_SERIAL) //get the busylights with serialNumber to adress the right one
          if (found != undefined ) {busylights[found.index].light('000000')} // set all depending lights to off
      })
    }
  }