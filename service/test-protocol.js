// 测试解析火山引擎二进制协议

// 服务端返回的错误数据
const errorData = Buffer.from([
  2, 174, 165, 64, 0, 0, 0, 151, 123, 34, 101, 114, 114, 111, 114, 34,
  58, 34, 100, 101, 99, 111, 100, 101, 32, 119, 115, 32, 114, 101, 113,
  117, 101, 115, 116, 32, 102, 97, 105, 108, 101, 100, 58, 32, 117, 110,
  97, 98, 108, 101, 32, 116, 111, 32, 100, 101, 99, 111, 100, 101, 32, 86,
  49, 32, 112, 114, 111, 116, 111, 99, 111, 108, 32, 109, 101, 115, 115,
  97, 103, 101, 58, 32, 100, 101, 99, 108, 97, 114, 101, 100, 32, 98, 111,
  100, 121, 32, 115, 105, 122, 101, 32, 100, 111, 101, 115, 32, 110, 111,
  116, 32, 109, 97, 116, 99, 104, 32, 97, 99, 116, 117, 97, 108, 32, 98,
  111, 100, 121, 32, 115, 105, 122, 101, 58, 32, 101, 120, 112, 101, 99,
  116, 101, 100, 61, 49, 48, 48, 32, 97, 99, 116, 117, 97, 108, 61, 50,
  48, 56, 34, 125
]);

console.log('=== 原始数据 ===');
console.log(`Length: ${errorData.length}`);
console.log(`Data: [${Array.from(errorData).join(', ')}]`);
console.log();

console.log('=== 尝试解析 Header (前 4 字节) ===');
const header = errorData.slice(0, 4);
console.log('Header bytes:', header);

const byte0 = header[0];
const byte1 = header[1];
const byte2 = header[2];
const byte3 = header[3];

const protocolVersion = (byte0 >> 4) & 0b1111;
const headerSize = byte0 & 0b1111;
const messageType = (byte1 >> 4) & 0b1111;
const messageFlags = byte1 & 0b1111;
const serializationMethod = (byte2 >> 4) & 0b1111;
const compressionMethod = byte2 & 0b1111;

console.log('Protocol version:', protocolVersion);
console.log('Header size:', headerSize);
console.log('Message type:', messageType);
console.log('Message flags:', messageFlags.toString(2).padStart(4, '0'));
console.log('Serialization method:', serializationMethod);
console.log('Compression method:', compressionMethod);
console.log();

// 尝试解析剩余数据
let offset = 4;

console.log('=== 尝试解析 Optional 部分 ===');
if (offset < errorData.length) {
  // 检查是否有 Payload Size (4字节)
  if (errorData.length >= offset + 4) {
    const payloadSize = errorData.readInt32BE(offset);
    console.log('Potential Payload Size at offset', offset, ':', payloadSize);
    offset += 4;
  }
}

console.log();
console.log('=== 尝试解析 Payload ===');
if (offset < errorData.length) {
  const payload = errorData.slice(offset);
  console.log('Payload length:', payload.length);
  
  // 尝试解析为 JSON
  try {
    const json = JSON.parse(payload.toString('utf8'));
    console.log('Payload (JSON):', JSON.stringify(json, null, 2));
  } catch (e) {
    console.log('Payload (UTF8):', payload.toString('utf8'));
    console.log('Payload (HEX):', payload.toString('hex'));
  }
}
