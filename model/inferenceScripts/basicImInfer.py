from ultralytics import YOLO
import sqlite3
import time

con = sqlite3.connect("../../backend/eventData.db")
c=con.cursor()
query = '''INSERT INTO events(eventId, timestamp, cameraID, snapshot, model, payload) VALUES(?,?,?,?,?,?)'''
model = YOLO("../weights/yolo26n-seg.pt")

def inferImage():
    # results = model(["../testData/images/IMG_1983.HEIC","../testData/images/IMG_1984.HEIC"])
    results = model(["../testData/images/IMG_1983.HEIC"])
    currentTime=time.time()
    i=0
    for result in results:
        
        boxes = result.boxes # Boxes object for bounding box outputs
        print(f"boxes {boxes}")

        masks = result.masks # Masks object for segmentation masks outputs
        # print(f"masks {masks}"")

        keypoints = result.keypoints # Keypoints object for pose outputs
        print(f"keypoints {keypoints}")

        probs = result.probs # Probs object for classification outputs
        print(f"probs {probs}")
        
        obb = result.obb # Oriented boxes object for OBB outputs
        print(f"obb {obb}")
        # print(boxes,masks, keypoints, probs, obb)
        event = (i,currentTime,1,"carrot","yolov?","blargh")
        c.execute(query,event)
        con.commit()
        result.show() # display to screen
        result.save(filename="result.jpg")

def inferVideo():
   
    results = model(["Some video input"])
    currentTime=time.time()
    i=0
    for result in results:
        
        boxes = result.boxes # Boxes object for bounding box outputs
        print(f"boxes {boxes}")

        masks = result.masks # Masks object for segmentation masks outputs
        # print(f"masks {masks}"")

        keypoints = result.keypoints # Keypoints object for pose outputs
        print(f"keypoints {keypoints}")

        probs = result.probs # Probs object for classification outputs
        print(f"probs {probs}")
        
        obb = result.obb # Oriented boxes object for OBB outputs
        print(f"obb {obb}")
        # print(boxes,masks, keypoints, probs, obb)
        event = (i,currentTime,1,"carrot","yolov?","blargh")
        c.execute(query,event)
        con.commit()
        result.show() # display to screen
        result.save(filename="result.jpg")

inferImage()
# FIX DATABASE QUERY