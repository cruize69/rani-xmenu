// Client-side only. The manager password lives in sessionStorage, typed in
// per browser session — never baked into the build, so it can't be read out
// of the public JS bundle the way a VITE_-prefixed env var would be.
const STORAGE_KEY = "rm_manager_secret";

export const getManagerSecret = () => sessionStorage.getItem(STORAGE_KEY) ?? "";
export const setManagerSecret = (value) => sessionStorage.setItem(STORAGE_KEY, value);
export const clearManagerSecret = () => sessionStorage.removeItem(STORAGE_KEY);
