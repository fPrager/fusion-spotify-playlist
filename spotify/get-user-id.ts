import { load } from "https://deno.land/std/dotenv/mod.ts";

const getUserId = async () : string  => {
  const env = await load();
  const id = env["USER_ID"];
  if(!id) {
    throw new Error('missing USER_ID in env')
  }
  return id
} 

export default getUserId