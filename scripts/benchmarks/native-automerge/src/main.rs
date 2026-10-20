use automerge::Automerge;
use std::{fs, hint::black_box, time::Instant};
fn main() {
    let args: Vec<_> = std::env::args().collect();
    let bytes = fs::read(&args[1]).unwrap();
    let check = Automerge::load(&bytes).unwrap();
    fs::write(format!("{}.native", args[1]), check.save()).unwrap();
    drop(check);
    let mut load = Vec::new();
    let mut save = Vec::new();
    for i in 0..25 {
        let start = Instant::now();
        let doc = Automerge::load(&bytes).unwrap();
        let l = start.elapsed().as_secs_f64() * 1000.;
        let start = Instant::now();
        black_box(doc.save());
        let s = start.elapsed().as_secs_f64() * 1000.;
        if i >= 5 {
            load.push(l);
            save.push(s);
        }
    }
    load.sort_by(f64::total_cmp);
    save.sort_by(f64::total_cmp);
    println!(
        "bytes={} native_load_median_ms={:.3} native_save_median_ms={:.3}",
        bytes.len(),
        load[10],
        save[10]
    );
}
