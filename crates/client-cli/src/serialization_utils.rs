pub mod vec_arc_rwlock_serde {
    use serde::{Deserialize, Serialize};
    use serde::de::Deserializer;
    use serde::ser::Serializer;
    use std::sync::{Arc, RwLock};
    use serde::ser::{SerializeSeq};

    pub fn serialize<S, T>(val: &Vec<Arc<RwLock<T>>>, s: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
        T: Serialize,
    {
        let mut seq = s.serialize_seq(Some(val.len()))?;
        for element in val {
            seq.serialize_element(&*element.read().unwrap())?;
        }
        seq.end()
    }

    pub fn deserialize<'de, D, T>(d: D) -> Result<Vec<Arc<RwLock<T>>>, D::Error>
    where
        D: Deserializer<'de>,
        T: Deserialize<'de>,
    {
        let mut items = vec![];
        for item in Vec::<T>::deserialize(d)? {
            items.push(Arc::new(RwLock::new(item)));
        }
        Ok(items)
    }
}
