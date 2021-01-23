//Written by: SwiFT EQ and CinderBlock

/*
    @TODO:
        - Multiply floor grid scales by 2.54?
			- Currently have it multiplied and looks about right, but will need to verify with Test 2 or 3
        - Fix rotations
		- Add null object to track ball location and rotation
*/

/*
    NOTES:
        - The direction the Y and Z axes point are the negative direction. X seems to point positive.
        - ROTATIONS (in AE)
            - Rotation around X is Pitch
            - Rotation around Y is Yaw
            - Rotation around Z is Roll
        - LOCATION COORDINATE TRANSLATIONS
            - (AE on left, RL on right)
                - X =  Y
                - Y = -Z
                - Z =  X
            - (RL on left, AE on right)
                - X =  Z
                - Y =  X
                - Z = -Y
*/


// GLOBAL VARIABLES //
var BlueColor = [0.35, 0.45, 0.9];
var OrangeColor = [0.95, 0.55, 0.2];

// RUN THE SCRIPT //
main();


// MAIN FUNCTION //
function main()
{
    app.beginUndoGroup("CinematicsBuddyAE Import");

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
    var ChosenFile = File.openDialog("Choose a Cinematics Buddy export file");

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
    var bFirstLine = true;
    var bReadingHeader = true;
    var VersionNumber = "";
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
        
        //Check the first line to see if it is a valid CB file. Get the version number from it
        if(bFirstLine)
        {
            bFirstLine = false;
            if(ThisLine.indexOf("Version:") == -1)
            {
                alert("File is not a CinematicsBuddy file. First line needs to have Version:");
                RemoveCompObjects(Objects);
                app.endUndoGroup();
                return;
            }
            
            var VersionNumberSplit = ThisLine.split(" ");
            VersionNumber = VersionNumberSplit.slice(1, VersionNumberSplit.length).join();
            continue;
        }
        
        //Read all the other lines to either get metadata or keyframes
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
    CameraLayer.property("Transform").property("X Position").setValuesAtTimes(TimeArray, PosXArray);
    CameraLayer.property("Transform").property("Y Position").setValuesAtTimes(TimeArray, PosYArray);
    CameraLayer.property("Transform").property("Z Position").setValuesAtTimes(TimeArray, PosZArray);
    CameraLayer.property("Transform").property("X Rotation").setValuesAtTimes(TimeArray, RotXArray);
    CameraLayer.property("Transform").property("Y Rotation").setValuesAtTimes(TimeArray, RotYArray);
    CameraLayer.property("Transform").property("Z Rotation").setValuesAtTimes(TimeArray, RotZArray);

    //Clean up and return
    app.endUndoGroup();    
    return "Version " + VersionNumber;
}


// UTILITY FUNCTIONS //
//Create camera, plane, and text objects
function CreateCompObjects(MyComp)
{
    //Objects are added to layers in reverse order of what's seen here
    //Camera should be created last so it will be on top
    var Objects = new Object();
    
    //Grids to approximate field
    CreateGrids(MyComp, Objects);
    
    //Labels in goals
    Objects.BlueGoalLabel = CreateBlueGoalLabel(MyComp);
    Objects.OrangeGoalLabel = CreateOrangeGoalLabel(MyComp);
    
    //Camera
    Objects.CameraLayer = CreateCamera(MyComp);
    
    return Objects;
}

//Create all of the walls, floor, and ceiling reference grids
function CreateGrids(MyComp, Objects)
{
    //Floor
    var FloorLayer = CreateGrid(MyComp, "Floor");
    FloorLayer.property("Position").setValue([0, 0, 0]);
    FloorLayer.property("Scale").setValue([1024 * 2.54, 819.2 * 2.54, 100]);
    FloorLayer.property("X Rotation").setValue(-90);
    
    //Ceiling
    var CeilingLayer = CreateGrid(MyComp, "Ceiling");
    CeilingLayer.property("Position").setValue([0, 2044 * -2.54, 0]);
    CeilingLayer.property("Scale").setValue([1024 * 2.54, 819.2 * 2.54, 100]);
    CeilingLayer.property("X Rotation").setValue(-90);
    
    //Positive X Wall
    var LeftWallLayer = CreateGrid(MyComp, "Left Wall");
    LeftWallLayer.property("Position").setValue([0, 2044 * -2.54 / 2, 4096 * 2.54]);
    LeftWallLayer.property("Scale").setValue([1024 * 2.54, 204.4 * 2.54, 100]);
    LeftWallLayer.property("Effects").property("ADBE Grid").property("Height").setValue(80);
    
    //Negative X Wall
    var RightWallLayer = CreateGrid(MyComp, "Right Wall");
    RightWallLayer.property("Position").setValue([0, 2044 * -2.54 / 2, 4096 * -2.54]);
    RightWallLayer.property("Scale").setValue([1024 * 2.54, 204.4 * 2.54, 100]);
    RightWallLayer.property("Effects").property("ADBE Grid").property("Height").setValue(80);
    
    //Blue goal wall
    var BlueWallLayer = CreateGrid(MyComp, "Blue Wall");
    BlueWallLayer.property("Position").setValue([-5120 * 2.54, 2044 * -2.54 / 2, 0]);
    BlueWallLayer.property("Scale").setValue([819.2 * 2.54, 204.4 * 2.54, 100]);
    BlueWallLayer.property("Y Rotation").setValue(90);
    BlueWallLayer.property("Effects").property("ADBE Grid").property("Width").setValue(22);
    BlueWallLayer.property("Effects").property("ADBE Grid").property("Height").setValue(80);
    BlueWallLayer.property("Effects").property("ADBE Ramp").property("End Color").setValue(BlueColor);
    
    //Orange goal wall
    var OrangeWallLayer = CreateGrid(MyComp, "Orange Wall");
    OrangeWallLayer.property("Position").setValue([5120 * 2.54, 2044 * -2.54 / 2, 0]);
    OrangeWallLayer.property("Scale").setValue([819.2 * 2.54, 204.4 * 2.54, 100]);
    OrangeWallLayer.property("Y Rotation").setValue(90);
    OrangeWallLayer.property("Effects").property("ADBE Grid").property("Width").setValue(22);
    OrangeWallLayer.property("Effects").property("ADBE Grid").property("Height").setValue(80);
    OrangeWallLayer.property("Effects").property("ADBE Ramp").property("Start Color").setValue(OrangeColor);
    
    //Add all grids to objects collection
    Objects.FloorLayer = FloorLayer;
    Objects.CeilingLayer = CeilingLayer;
    Objects.LeftWallLayer = LeftWallLayer;
    Objects.RightWallLayer = RightWallLayer;
    Objects.BlueWallLayer = BlueWallLayer;
    Objects.OrangeWallLayer = OrangeWallLayer;
}

//Create a plane with a grid effect
function CreateGrid(MyComp, GridName)
{
    var NewGrid = MyComp.layers.addSolid([1,1,1], GridName, 1000, 1000, 1);
    NewGrid.guideLayer = true;
    NewGrid.threeDLayer = true;
    
    //Gradient ramp effect
    var GradientEffect = NewGrid.property("Effects").addProperty("ADBE Ramp");
    GradientEffect.property("Start of Ramp").setValue([0, 500]);
    GradientEffect.property("End of Ramp").setValue([1000, 500]);
    GradientEffect.property("Start Color").setValue(BlueColor);
    GradientEffect.property("End Color").setValue(OrangeColor);
    
    //Grid effect
    var GridEffect = NewGrid.property("Effects").addProperty("ADBE Grid");
    GridEffect.property("Size From").setValue(3);
    GridEffect.property("Width").setValue(16);
    GridEffect.property("Height").setValue(20);
    GridEffect.property("Border").setValue(2);
    GridEffect.property("Blending Mode").setValue(3);
    
    return NewGrid;
}

//Create camera 
function CreateCamera(MyComp)
{
    var CameraLayer = MyComp.layers.addCamera("UNNAMED CAMERA", [MyComp.width / 2, MyComp.height / 2]);
    CameraLayer.autoOrient = AutoOrientType.NO_AUTO_ORIENT;
    CameraLayer.property("Position").dimensionsSeparated = true;
    
    return CameraLayer;
}

//Create text label filling blue goal
function CreateBlueGoalLabel(MyComp)
{
    var BlueGoalLabel = MyComp.layers.addText("Blue Goal");
    BlueGoalLabel.guideLayer = true;
    BlueGoalLabel.threeDLayer = true;
    BlueGoalLabel.property("Position").setValue([-5120 * 2.54, -600, 0]);
    BlueGoalLabel.property("Y Rotation").setValue(-90);
    var TextDocument = BlueGoalLabel.property("Source Text").value;
    TextDocument.font = "Arial-BoldMT";
    TextDocument.fontSize = 1000;
    TextDocument.fillColor = BlueColor;
    TextDocument.strokeColor = [0, 0, 0];
    TextDocument.strokeWidth = 50;
    BlueGoalLabel.property("Source Text").setValue(TextDocument);
    
    return BlueGoalLabel;
}

//Create text label filling orange goal
function CreateOrangeGoalLabel(MyComp)
{
    var OrangeGoalLabel = MyComp.layers.addText("Orange Goal");
    OrangeGoalLabel.guideLayer = true;
    OrangeGoalLabel.threeDLayer = true;
    OrangeGoalLabel.property("Position").setValue([5120 * 2.54, -600, 0]);
    OrangeGoalLabel.property("Y Rotation").setValue(90);
    var TextDocument = OrangeGoalLabel.property("Source Text").value;
    TextDocument.font = "Arial-BoldMT";
    TextDocument.fontSize = 750;
    TextDocument.fillColor = OrangeColor;
    TextDocument.strokeColor = [0, 0, 0];
    TextDocument.strokeWidth = 50;
    OrangeGoalLabel.property("Source Text").setValue(TextDocument);
    
    return OrangeGoalLabel;
}

//Delete the comp objects
function RemoveCompObjects(Objects)
{
    Objects.CameraLayer.remove();
    Objects.FloorLayer.remove();
    Objects.CeilingLayer.remove();
    Objects.LeftWallLayer.remove();
    Objects.RightWallLayer.remove();
    Objects.BlueWallLayer.remove();
    Objects.OrangeWallLayer.remove();
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
    var FOV = parseFloat(InFOV);
    var FOVRads = (FOV / 2) * (Math.PI / 180);
    var Zoom = MyComp.width / (2 * Math.tan(FOVRads));
    
    return Zoom;
}

//Position
function GetPosition(PositionVals)
{
    var Position = new Object();
    Position.X = parseFloat(PositionVals[1]) *  2.54;
    Position.Y = parseFloat(PositionVals[2]) * -2.54;
    Position.Z = parseFloat(PositionVals[0]) *  2.54;
    
    return Position;
}

//Rotation
function GetRotation(QuatVals)
{
    //Use the old function for now
    //New function will be based on: https://www.euclideanspace.com/maths/geometry/rotations/conversions/quaternionToEuler/
    return GetRotationOld(QuatVals);
}

function GetRotationOld(QuatVals)
{
    // NOTE: THIS OLD FUNCTION IS BAD IN THE PITCH ROTATION //
    
    var quatX = parseFloat(QuatVals[0]);
    var quatY = parseFloat(QuatVals[1]);
    var quatZ = parseFloat(QuatVals[2]);
    var quatW = parseFloat(QuatVals[3]);
    
    //Do the swaps here (once you figure them out) or maybe later, who knows
    var qX = quatX;
    var qY = quatY;
    var qZ = quatZ;
    var qW = quatW;

    //Roll
    var sinr_cosp = 2 * (qW * qX + qY * qZ);
    var cosr_cosp = 1 - 2 * (qX * qX + qY * qY);
    var Roll = Math.atan2(sinr_cosp, cosr_cosp);
    
    //Pitch
    var Pitch = 0;
    var sinp = 2 * (qW * qY - qZ * qX);
    if (Math.abs(sinp) >= 1)
        Pitch = CopySign(Math.PI / 2, sinp); // use 90 degrees if out of range
    else
        Pitch = Math.asin(sinp);

    //Yaw
    var siny_cosp = 2 * (qW * qZ + qX * qY);
    var cosy_cosp = 1 - 2 * (qY * qY + qZ * qZ);
    var Yaw = Math.atan2(siny_cosp, cosy_cosp);

    //Convert from radians to degrees
    var RadToDeg = 180 / Math.PI;
    var NewRoll  = Roll  * RadToDeg;
    var NewPitch = Pitch * RadToDeg;
    var NewYaw   = Yaw   * RadToDeg;

    //Output the rotation
    var Rotation = new Object();
    Rotation.X = NewPitch;
    Rotation.Y = NewYaw;
    Rotation.Z = NewRoll * -1;
    
    return Rotation;
}