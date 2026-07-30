
function toYMD(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): string {
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    return `${toYMD(dt)} 00:00:00`;
}

function startOfNextDay(d: Date): string {
    const dt = new Date(d);
    dt.setDate(dt.getDate() + 1);
    dt.setHours(0, 0, 0, 0);
    return `${toYMD(dt)} 00:00:00`;
}

function startOfNextMonth(d: Date): string {
    const dt = new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
    return `${toYMD(dt)} 00:00:00`;
}

function startOfNextYear(d: Date): string {
    const dt = new Date(d.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
    return `${toYMD(dt)} 00:00:00`;
}


export function computeRange(selectedRange: string, specificDate: Date | null) {
    const key = (selectedRange || "").toLowerCase();
    const now = new Date();

    if (key === "today") {
        const dayString = toYMD(now);
        return { mode: "single-day" as const, dayString };
    }

    if (key === "yesterday") {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        const dayString = toYMD(y);
        return { mode: "single-day" as const, dayString };
    }

    if (key === "specificdate" && specificDate) {
        const dayString = toYMD(specificDate);
        return { mode: "single-day" as const, dayString };
    }

    if (key === "last7days") {
        const end = new Date(now);
        const start = new Date(now);
        start.setDate(start.getDate() - 6);
        return {
            mode: "range" as const,
            startTime: startOfDay(start),
            endTime: startOfNextDay(end),
        };
    }

    if (key === "last30days") {
        const end = new Date(now);
        const start = new Date(now);
        start.setDate(start.getDate() - 29);
        return {
            mode: "range" as const,
            startTime: startOfDay(start),
            endTime: startOfNextDay(end),
        };
    }

    if (key === "last3months") {
        const end = new Date(now);
        const start = new Date(now);
        start.setDate(start.getDate() - 89);
        return {
            mode: "range" as const,
            startTime: startOfDay(start),
            endTime: startOfNextDay(end),
        };
    }

    if (key === "last6months") {
        const end = new Date(now);
        const start = new Date(now);
        start.setDate(start.getDate() - 179);
        return {
            mode: "range" as const,
            startTime: startOfDay(start),
            endTime: startOfNextDay(end),
        };
    }

    if (key === "lastyear") {
        const lastYearNum = now.getFullYear() - 1;
        const start = new Date(lastYearNum, 0, 1);
        const end = new Date(lastYearNum + 1, 0, 1);
        return {
            mode: "range" as const,
            startTime: startOfDay(start),
            endTime: startOfDay(end),
        };
    }

    if (key === "thismonth") {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
            mode: "range" as const,
            startTime: startOfDay(start),
            endTime: startOfNextMonth(start),
        };
    }

    if (key === "thisyear") {
        const start = new Date(now.getFullYear(), 0, 1);
        return {
            mode: "range" as const,
            startTime: startOfDay(start),
            endTime: startOfNextYear(start),
        };
    }

    const fallbackStr = toYMD(now);
    return { mode: "single-day" as const, dayString: fallbackStr };
}
