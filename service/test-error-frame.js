
/**
 * 测试解析错误帧
 */

// 原始错误数据的十六进制: 11f0100002aea5410000004a7b226572726f72223a22696e76616c696420582d4170692d4170702d4b65793a20383930303238383038382c2065787065637465643a5b506c67764d796d6337663374516e4a365d227d
const errorHex = '11f0100002aea5410000004a7b226572726f72223a22696e76616c696420582d4170692d4170702d4b65793a20383930303238383038382c2065787065637465643a5b506c67764d796d6337663374516e4a365d227d';
const errorData = Buffer.from(errorHex, 'hex');

console.log('原始数据长度:', errorData.length);
console.log('原始数据:', errorData);

// 解析 Header
const byte0 = errorData[0];
const byte1 = errorData[1];
const byte2 = errorData[2];
const byte3 = errorData[3];

const version = (byte0 >> 4) & 0b1111;
const headerSize = (byte0 & 0b1111) * 4;
const messageType = (byte1 >> 4) & 0b1111;
const flags = byte1 & 0b1111;
const serializationMethod = (byte2 >> 4) & 0b1111;
const compressionMethod = byte2 & 0b1111;

console.log('\nHeader 解析:');
console.log('  byte0:', byte0.toString(2).padStart(8, '0'), '-> version:', version, 'headerSize:', headerSize);
console.log('  byte1:', byte1.toString(2).padStart(8, '0'), '-> messageType:', messageType, 'flags:', flags.toString(2));
console.log('  byte2:', byte2.toString(2).padStart(8, '0'), '-> serializationMethod:', serializationMethod, 'compressionMethod:', compressionMethod);
console.log('  byte3:', byte3);

let offset = 4;

// 检查 event
let event = undefined;
if (flags & 0b0100) {
  event = errorData.readInt32BE(offset);
  offset += 4;
  console.log('\n有 Event:', event);
} else {
  console.log('\n无 Event');
}

// 检查 session id
let sessionId = undefined;
if ([1, 9, 11].includes(messageType)) {
  const sessionIdLen = errorData.readInt32BE(offset);
  offset += 4;
  console.log('\n有 Session ID, 长度:', sessionIdLen);
  if (sessionIdLen > 0) {
    sessionId = errorData.slice(offset, offset + sessionIdLen).toString();
    offset += sessionIdLen;
    console.log('Session ID:', sessionId);
  }
} else {
  console.log('\n无 Session ID (messageType:', messageType, ')');
}

// 解析 payload length
const payloadLen = errorData.readInt32BE(offset);
offset += 4;
console.log('\nPayload length:', payloadLen);

// 解析 payload
const payload = errorData.slice(offset, offset + payloadLen);
console.log('Payload offset:', offset);
console.log('Payload:', payload.toString());

try {
  const payloadJson = JSON.parse(payload.toString());
  console.log('\nPayload JSON:', payloadJson);
} catch (e) {
  console.log('\nPayload JSON 解析失败:', e);
}
