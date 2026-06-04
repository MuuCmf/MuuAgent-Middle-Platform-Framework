
const audioBase64 = 'UklGRiQCAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQ'; // test data
const audioDataBuffer = Buffer.from(audioBase64, 'base64');

const payload1 = JSON.stringify({
  audio: {
    data: audioDataBuffer,
    is_last: false,
  },
});

const payload2 = JSON.stringify({
  audio: {
    data: audioBase64,
    is_last: false,
  },
});

console.log('Payload 1 (Buffer):', payload1);
console.log('Payload 2 (Base64):', payload2);

console.log('Buffer length:', audioDataBuffer.length);
