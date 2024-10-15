pub mod server_error;
pub mod config;

#[macro_export]
macro_rules! make_wrapped_db_type {
    ($T:ident, $Inside:ty $(,$traits:ty)*) => {
        #[derive($($traits,)*)]
        pub struct $T($Inside);
        impl postgres_types::ToSql for $T {
            fn to_sql(&self, ty: &postgres_types::Type, out: &mut postgres_types::private::BytesMut) -> Result<postgres_types::IsNull, Box<dyn std::error::Error + Sync + Send>> { self.0.to_sql(ty, out) }
            fn accepts(ty: &postgres_types::Type) -> bool { <$Inside>::accepts(ty) }
            postgres_types::to_sql_checked!();
        }
        impl<'a> postgres_types::FromSql<'a> for $T {
            fn from_sql(ty: &postgres_types::Type, raw: &'a [u8]) -> Result<Self, Box<dyn std::error::Error + Sync + Send>> { Ok(Self(<$Inside>::from_sql(ty, raw)?)) }
            fn accepts(ty: &postgres_types::Type) -> bool { <$Inside>::accepts(ty) }
        }
    };
}
