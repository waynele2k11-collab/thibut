import { SignJWT, jwtVerify } from 'jose';

async function main() {
  const secret = new TextEncoder().encode('fallback_secret_for_dev');
  
  // 1. Valid token (expires in 20 days)
  const validToken = await new SignJWT({ orderNumber: 'TB-123', sessionId: 'sess-abc' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('20d')
    .sign(secret);
    
  console.log('Valid Token:', validToken);
  
  const validDecoded = await jwtVerify(validToken, secret);
  console.log('Valid decoded:', validDecoded.payload);
  
  // 2. Expired token (expired 1 second ago)
  const expiredToken = await new SignJWT({ orderNumber: 'TB-123', sessionId: 'sess-abc' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('-1s')
    .sign(secret);
    
  try {
    await jwtVerify(expiredToken, secret);
    console.error('FAIL: Expired token was accepted!');
  } catch (e: any) {
    console.log('SUCCESS: Expired token rejected with:', e.code);
  }
}

main().catch(console.error);
