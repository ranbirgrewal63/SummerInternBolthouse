import os
import cv2

def slice_image_into_100_frames(image_path, output_dir="output_100_frames"):
    # 1. Create the output folder if it does not exist
    os.makedirs(output_dir, exist_ok=True)
    
    # 2. Load your single image
    image = cv2.imread(image_path)
    if image is None:
        print(f"Error: Could not open or find the image at '{image_path}'.")
        return
        
    img_height, img_width, _ = image.shape

    # 3. Define a 10x10 grid to get exactly 100 frames
    rows = 10
    cols = 10

    # 4. Calculate exact width and height of each individual frame tile
    frame_width = img_width // cols
    frame_height = img_height // rows

    frame_count = 0
    
    # 5. Loop through the rows and columns to crop the image
    for r in range(rows):
        for c in range(cols):
            # Calculate pixel boundaries for the current tile
            y_start = r * frame_height
            y_end = (r + 1) * frame_height
            x_start = c * frame_width
            x_end = (c + 1) * frame_width
            
            # Crop the target frame out of the source image
            frame = image[y_start:y_end, x_start:x_end]
            
            # Build name using zfill so files sort correctly (000.jpg to 099.jpg)
            file_name = f"frame_{str(frame_count).zfill(3)}.jpg"
            output_path = os.path.join(output_dir, file_name)
            
            # Save the isolated frame
            cv2.imwrite(output_path, frame)
            frame_count += 1

    print(f"Success! Generated exactly {frame_count} frames in '{output_dir}/'.")

# Run the function (Replace 'your_picture.jpg' with your actual image file)
slice_image_into_100_frames(r"C:\Users\grewalr\Downloads\S324 Hewitson 43 Rodent harvest 6-9-24.jpeg")