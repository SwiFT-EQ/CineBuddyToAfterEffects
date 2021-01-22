/*
    TODO:
        - Create a plane with a grid effect to act as the ground
        - Add text above both goals saying Blue Goal and Orange Goal so it's easy to verify timeline alignment of track
*/


// RUN THE SCRIPT //
main();


// MAIN FUNCTION //
function main()
{
    app.beginUndoGroup("CinematicsBuddy Import");

    //Get the current active comp
    var MyComp = app.project.activeItem;
    if(MyComp == null)
    {
        alert("No selected comp");
        app.endUndoGroup();
        return;
    }

    //Create objects and get a handle to the camera
    var Objects = CreateCompObjects(MyComp);
    var CameraLayer = Objects.CameraLayer;
    
    //Get user's file selection
    var ChosenFile = File.openDialog("Popup Title");

    //Read the file, then close it
    if(ChosenFile && ChosenFile.open("r"))
    {
        var data = ChosenFile.read();        
        ChosenFile.close();
    }
    else
    {
        //File was either not selected or unable to be opened
        alert("Invalid file");
        RemoveCompObjects(Objects);
        app.endUndoGroup();
        return;
    }

    //Split entire file into its individual lines
    var Lines = data.toString().split("\n");

    //Prepare for parsing lines
    var bReadingHeader = true;
    var CameraName = "";
    var TimeSkip = 0;
    var CompTime = 0;
    var TimeArray = [];
    var ZoomArray = [];
    var PosXArray = [];
    var PosYArray = [];
    var PosZArray = [];
    var RotXArray = [];
    var RotYArray = [];
    var RotZArray = [];
    
    //Parse all the lines to get useful data
    for(i = 0; i < Lines.length; ++i)
    {
        var ThisLine = Lines[i];
        
        if(bReadingHeader)
        {
            //Not yet past the header. Get metadata
            //Check if line contains "Camera:". Pull the camera name from that line
            if(ThisLine.indexOf("Camera:") > -1)
            {
                var CameraNameSplit = ThisLine.split(" ");
                CameraLayer.name = CameraNameSplit.slice(1, CameraNameSplit.length).join();
                continue;
            }
            
            //Check if line contains "Framerate:". Calculate TimeSkip from that line
            if(ThisLine.indexOf("Framerate:") > -1)
            {
                var FrameRate = parseInt(ThisLine.split(" ").slice(1, 3).join());
                var CompFramerate = 1 / MyComp.frameDuration;
                var Subframes = FrameRate / CompFramerate;
                TimeSkip = MyComp.frameDuration / Subframes;
                continue;
            }
            
            //Check if line contains "Timestamp". This is the final header line and should be skipped
            if(ThisLine.indexOf("Timestamp") > -1)
            {
                bReadingHeader = false;
                continue;
            }
        }
        else
        {
            //Already past the header. Get all the keyframe data and check if the file is done
            //Check if line contains "END". Remove last empty line
            if(ThisLine.indexOf("END") > -1)
            {
                break;
            }

            //Get the keyframe data and add to arrays
            var LineToConvert = ThisLine.split("\t").slice(3, 6).join();
            Keyframe = ConvertKeyframeData(LineToConvert, MyComp);
            
            ZoomArray.push(Keyframe.Zoom);
            PosXArray.push(Keyframe.PosX);
            PosYArray.push(Keyframe.PosY);
            PosZArray.push(Keyframe.PosZ);
            RotXArray.push(Keyframe.RotX);
            RotYArray.push(Keyframe.RotY);
            RotZArray.push(Keyframe.RotZ);
            
            TimeArray.push(CompTime);
            CompTime += TimeSkip;
        }
    }

    //Apply the arrays
    CameraLayer.property("Camera Options").property("Zoom").setValuesAtTimes( TimeArray, ZoomArray);
    //CameraLayer.property("Transform").property("X Position").setValuesAtTimes(TimeArray, PosXArray);
    //CameraLayer.property("Transform").property("Y Position").setValuesAtTimes(TimeArray, PosYArray);
    //CameraLayer.property("Transform").property("Z Position").setValuesAtTimes(TimeArray, PosZArray);
    CameraLayer.property("Transform").property("X Rotation").setValuesAtTimes(TimeArray, RotXArray);
    CameraLayer.property("Transform").property("Y Rotation").setValuesAtTimes(TimeArray, RotYArray);
    CameraLayer.property("Transform").property("Z Rotation").setValuesAtTimes(TimeArray, RotZArray);
    
    
    
    
    
    
    
    // FOR TESTING //
    CameraLayer.property("Transform").property("X Position").setValue(0);
    CameraLayer.property("Transform").property("Y Position").setValue(-100);//wtf AE, why does negative move up
    CameraLayer.property("Transform").property("Z Position").setValue(0);





    //Clean up and return
    app.endUndoGroup();    
    return "Big success!";
}


// UTILITY FUNCTIONS //
//Create camera, plane, and text objects
function CreateCompObjects(MyComp)
{
    //Create object collector
    var Objects = new Object();
    
    //Create a floor plane with a grid effect
    var FloorLayer = MyComp.layers.addSolid([1,1,1], "Display Floor", 1000, 1000, 1);
    FloorLayer.guideLayer = true;
    FloorLayer.threeDLayer = true;
    FloorLayer.property("Position").setValue([0, 0, 0]);
    FloorLayer.property("Scale").setValue([1024, 819.2, 100]);
    FloorLayer.property("X Rotation").setValue(-90);
    var GridEffect = FloorLayer.property("Effects").addProperty("ADBE Grid");
    GridEffect.property("Size From").setValue(3);
    GridEffect.property("Width").setValue(16);
    GridEffect.property("Height").setValue(20);
    GridEffect.property("Border").setValue(2);
    GridEffect.property("Blending Mode").setValue(3);
    
    //Create camera and initialize its values
    var CameraLayer = MyComp.layers.addCamera("UNNAMED CAMERA", [MyComp.width / 2, MyComp.height / 2]);
    CameraLayer.autoOrient = AutoOrientType.NO_AUTO_ORIENT;
    CameraLayer.property("Position").dimensionsSeparated = true;
    
    //Collect objects
    Objects.CameraLayer = CameraLayer;
    Objects.FloorLayer = new Object();
    Objects.BlueGoalLabel = new Object();
    Objects.OrangeGoalLabel = new Object();
    
    return Objects;
}

//Delete the comp objects
function RemoveCompObjects(Objects)
{
    Objects.CameraLayer.remove();
    Objects.FloorLayer.remove();
    Objects.BlueGoalLabel.remove();
    Objects.OrangeGoalLabel.remove();
}

//Copy the sign from Y onto X
function CopySign(x, y)
{
    if(y < 0)
    {
        if(x >= 0) { x *= -1; }
    }
    else
    {
        if(x < 0) { x *= -1; }
    }

    return x;
}

//Convert keyframe data from RL's coordinates to AE's coordinates
function ConvertKeyframeData(ThisLine, MyComp)
{
    var Zoom = GetZoom(ThisLine.split(",").slice(0,1), MyComp);
    var Position = GetPosition(ThisLine.split(",").slice(1,4));
    var Rotation = GetRotation(ThisLine.split(",").slice(4,8));
    
    //Create keyframe
    var Keyframe = new Object();
    Keyframe.Zoom = Zoom;
    Keyframe.PosX = Position.X;
    Keyframe.PosY = Position.Y;
    Keyframe.PosZ = Position.Z;
    Keyframe.RotX = Rotation.X;
    Keyframe.RotY = Rotation.Y;
    Keyframe.RotZ = Rotation.Z;
    
    return Keyframe;
}

//Zoom
function GetZoom(InFOV, MyComp)
{
    var AspectRatio = MyComp.width / MyComp.height;
    var FOV = parseFloat(InFOV) / AspectRatio;
    var FOVRads = (FOV / 2) * (Math.PI / 180);
    var Zoom = MyComp.width / (2 * Math.tan(FOVRads));
    
    //var Zoom = 2 * Math.tan(FOVRads) * MyComp.height;
    
    return Zoom;
}

//Position
function GetPosition(PositionVals)
{
    var Position = new Object();
    Position.X = parseFloat(PositionVals[0]) * 2.54;
    Position.Y = parseFloat(PositionVals[2]) * -2.54;
    Position.Z = parseFloat(PositionVals[1]) * -2.54;
    
    return Position;
}

//Rotation
function GetRotation(QuatVals)
{    
    var quatX = parseFloat(QuatVals[0]);
    var quatY = parseFloat(QuatVals[1]);
    var quatZ = parseFloat(QuatVals[2]);
    var quatW = parseFloat(QuatVals[3]);
    
    //Do the swaps here (once you figure them out) or maybe later, who knows
    var qX = quatX;
    var qY = quatY;
    var qZ = quatZ;
    var qW = quatW;

    //X (roll in wiki)
    var sinr_cosp = 2 * (qW * qX + qY * qZ);
    var cosr_cosp = 1 - 2 * (qX * qX + qY * qY);
    var X = Math.atan2(sinr_cosp, cosr_cosp);

    //Y (yaw in wiki)
    var siny_cosp = 2 * (qW * qZ + qX * qY);
    var cosy_cosp = 1 - 2 * (qY * qY + qZ * qZ);
    var Y = Math.atan2(siny_cosp, cosy_cosp);

    //Z (pitch in wiki)
    var Z = 0;
    var sinp = 2 * (qW * qY - qZ * qX);
    if (Math.abs(sinp) >= 1)
        Z = CopySign(Math.PI / 2, sinp); // use 90 degrees if out of range
    else
        Z = Math.asin(sinp);

    //Output the rotation
    RadToDeg = 180 / Math.PI;
    X = (X * RadToDeg) * -1;
    Y = (Y * RadToDeg);// + 90;
    Z = (Z * RadToDeg) * -1;
    
    var Rotation = new Object();
    Rotation.X = Z;
    Rotation.Y = Y;
    Rotation.Z = X;
    
    return Rotation;
}