-- the scan checklist is now: scanned / disk uploaded / plan ready. "disk collected" and "uploaded" were merged into one.
update public.patient_scans
set disk_collected = (disk_collected or uploaded),
    uploaded = (disk_collected or uploaded);
