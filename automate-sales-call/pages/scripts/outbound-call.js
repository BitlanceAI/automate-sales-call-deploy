/*require('dotenv').config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);
console.log('ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID);
console.log('AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN);
async function makeOutBoundCall() {
  const call = await client.calls.create({
    url: `https://${process.env.SERVER}/incoming`,
    to: process.env.YOUR_NUMBER,
    from: process.env.FROM_NUMBER,
    record: true,
  });

  console.log('Call SID:', call.sid);
  return call.sid;
}

module.exports = { makeOutBoundCall }; // ✅ fixed
*/
require('dotenv').config();
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);

// Debug logs (optional)
console.log('ACCOUNT_SID:', accountSid);
console.log('AUTH_TOKEN:', authToken ? '[REDACTED]' : 'Missing');
console.log('SERVER URL:', process.env.SERVER);

async function makeOutBoundCall(toNumber) {
  const phoneNumberToCall = toNumber || process.env.YOUR_NUMBER;

  if (!phoneNumberToCall) {
    throw new Error('Phone number not provided and not found in .env');
  }

  const call = await client.calls.create({
    url: `${process.env.SERVER}/incoming`,
    to: phoneNumberToCall,
    from: process.env.FROM_NUMBER,
    record: true,
  });

  console.log('Call SID:', call.sid);
  return call.sid;
}

module.exports = { makeOutBoundCall };
