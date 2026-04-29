use napi_derive::napi;

#[napi]
pub fn native_available() -> bool {
    true
}