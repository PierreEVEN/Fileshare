
pub fn teimstamp_to_xml(t: u64) -> String {
    let h = t / 3600;
    let m = t % 3600 / 60;
    let s = t % 3600 % 60;
    let mut tag = "PT".to_string();
    if h != 0 { tag = format!("{}{}H", tag, h); }
    if m != 0 { tag = format!("{}{}M", tag, m); }
    if s != 0 { tag = format!("{}{}S", tag, s); }
    tag
}
