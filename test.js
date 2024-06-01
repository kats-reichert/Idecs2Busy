const BusyLight = require('@pureit/busylight').BusyLight;
const devices = BusyLight.devices();
console.log('======================================================================================================')
console.log('GETTING ALL CONNECTED BUSYLIGHTS .....')
console.log('======================================================================================================')

//console.log(devices)
const ColorId = ['red', 'green', 'blue', 'yellow', 'white', 'pink', 'cyan', 'amber']
const ColorValue = ['ff0000', '00ff00', '0000ff', 'ffff00', 'ffffff', 'ff00ff', '00ffff', 'ff2200']
var busylight = []
devices.forEach ((data, index) => {
    console.log("Found device with index: " + index + "\r\n SerialNumber: " + data.serialNumber + "\r\n Product: " + data.product )
    console.log('Setting to Color: ' + ColorId[index])
    console.log('======================================================================================================')
    busylight[index] = new BusyLight(devices[index])
    busylight[index].connect()
    //busylight[index].light(ColorValue[index])
    busylight[index].pulse(ColorValue[index])
    data.index = index
})


