var file = File.openDialog("Popup Title");

if (file && file.open("r")) {
    // Read file
    var data = file.read();
    // Print contents
    //alert(data);
    // Close file
    file.close();
}
var lines = data.toString().split("\n");
output = "";
for(i=0; i < lines.length; i+=4){
    if (lines[i].indexOf("\t") > -1 && lines[i].indexOf("Camera") == -1){
        output += lines[i].split("\t").slice(3, 6).join() + "\n";
    }
}
var lines = output.toString().split("\n");
outputCSV = "";
var myComp = app.project.activeItem;
function degreesToRadians(degrees)
{
  var pi = Math.PI;
  return degrees * (pi/180);
}
function mathSign(x){
    Math.sign = function(x) {
        return ((x > 0) - (x < 0)) || +x;
    };
}

for(i=0; i < lines.length; i++){
    if (lines[i].indexOf(",") > -1 && lines[i].indexOf("Camera") == -1){
        var FOV = lines[i].split(",").slice(0,1)
        var FOV = parseInt(FOV);
        var zoom = myComp.width/(2*Math.tan(degreesToRadians(FOV/2)));
        outputCSV += (zoom * 2/3) + ",";
        var position = lines[i].split(",").slice(1,4); //Position variable
        var newPosition = [];
        newPosition[0]=parseFloat(position[0])*2.54; //x-axis
        newPosition[1]=parseFloat(position[2])*2.54*-1; //y-axis
        newPosition[2]=parseFloat(position[1])*2.54*-1; //z-axis
        outputCSV += newPosition.join() + ",";

        var quaternion = lines[i].split(",").slice(4,8);//Quaternion variable
        var quatX = parseFloat(quaternion[0]);
        var quatY = parseFloat(quaternion[1]);
        var quatZ = parseFloat(quaternion[2]);
        var quatW = parseFloat(quaternion[3]);

        var sinr_cosp = 2 * (quatW * quatX + quatY * quatZ);
        var cosr_cosp = 1 - 2 * (quatX * quatX + quatY * quatY);
        var rotX = Math.atan2(sinr_cosp, cosr_cosp);

        var sinp = 2 * (quatW * quatY - quatZ * quatX);
        if (Math.abs(sinp) >= 1)

            rotY = Math.sign(Math.PI / 2, sinp); // use 90 degrees if out of range
        else
            rotY = Math.asin(sinp);

        var siny_cosp = 2 * (quatW * quatZ + quatX * quatY);
        var cosy_cosp = 1 - 2 * (quatY * quatY + quatZ * quatZ);
        var rotZ = Math.atan2(siny_cosp, cosy_cosp);
    
        var rotX = rotX * (180/Math.PI);
        var rotY = rotY * (180/Math.PI);
        var rotZ = rotZ * (180/Math.PI);
        outputCSV += (-(rotX)) + "," + (90+rotZ) + "," + (180+rotY);
        outputCSV += "\n";
    }
    var runs = i;
}
$.sleep(2000) //tell extendscript to sleep 2000 milliseconds
//alert(runs)
var myComp = app.project.activeItem; 
var layer = myComp.selectedLayers;
var lines = outputCSV.split("\n")

for (i=0; i < lines.length; i++) { 
    var AEValues = lines[i].split(","); 
    
    layer[0].property("Camera Options").property("Zoom").setValueAtTime(myComp.time,parseFloat(AEValues[0]));

    layer[0].property("Transform").property("X Position").setValueAtTime(myComp.time,parseFloat(AEValues[1]));

    layer[0].property("Transform").property("Y Position").setValueAtTime(myComp.time,parseFloat(AEValues[2]));

    layer[0].property("Transform").property("Z Position").setValueAtTime(myComp.time,parseFloat(AEValues[3]));

    layer[0].property("Transform").property("X Rotation").setValueAtTime(myComp.time,parseFloat(AEValues[4]));

    layer[0].property("Transform").property("Y Rotation").setValueAtTime(myComp.time,parseFloat(AEValues[5]));

    layer[0].property("Transform").property("Z Rotation").setValueAtTime(myComp.time,parseFloat(AEValues[6]));
    
    jumpFrames = 1;
    app.project.activeItem.time += jumpFrames*app.project.activeItem.frameDuration;
}