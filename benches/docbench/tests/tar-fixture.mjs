export function tarRecord(name, content = "", { prefix = "", type = "0", gnu = false } = {}) {
  const data = Buffer.from(content);
  const record = Buffer.alloc(512 + Math.ceil(data.length / 512) * 512);
  record.write(name, 0, 100);
  record.write("0000644\0", 100);
  record.write("0000000\0", 108);
  record.write("0000000\0", 116);
  record.write(data.length.toString(8).padStart(11, "0") + "\0", 124);
  record.write("00000000000\0", 136);
  record.fill(32, 148, 156);
  record.write(type, 156);
  record.write(gnu ? "ustar  \x00" : "ustar\x0000", 257);
  record.write(prefix, 345, 155);
  const sum = record.subarray(0, 512).reduce((total, byte) => total + byte, 0);
  record.write(sum.toString(8).padStart(6, "0") + "\0 ", 148);
  data.copy(record, 512);
  return record;
}

export function tarFixture(...records) {
  return Buffer.concat([...records, Buffer.alloc(1024)]);
}
