const getUserId = ():string  => {
  const id = Deno.env.get("USER_ID")
  if(!id) {
    throw new Error('missing USER_ID in env')
  }
  return id
} 

export default getUserId