
export interface CarrotRecord {
    id: number;
    time_stamp: string;
    length: number | null;
    diameter: number | null;
}

export interface DebrisRecord {
    time_stamp: string;
    debris_type: string;
    image_path?: string;
    event_id?: string;
}

