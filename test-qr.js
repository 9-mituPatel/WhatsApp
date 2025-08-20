import qrcode from 'qrcode';

console.log('🧪 Testing QR Code Generation...');

async function testQRCode() {
  try {
    // Generate a realistic test QR code data (simulating WhatsApp QR format)
    const testQRData = `1@${Math.random().toString(36).substring(2, 15)},${Math.random().toString(36).substring(2, 15)},${Date.now()},3,demo`;
    
    console.log('📱 Generating QR code with data:', testQRData);
    
    // Generate actual QR code using qrcode library
    const qrCodeDataURL = await qrcode.toDataURL(testQRData, {
      errorCorrectionLevel: 'L',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    });
    
    console.log('✅ QR Code generated successfully!');
    console.log('📏 QR Code Data URL length:', qrCodeDataURL.length);
    console.log('🔗 QR Code Data URL prefix:', qrCodeDataURL.substring(0, 50) + '...');
    
    // Also display QR in terminal for debugging
    qrcode.toString(testQRData, { type: 'terminal', small: true }, (err, url) => {
      if (!err) {
        console.log('\n📱 QR Code in Terminal:');
        console.log(url);
        console.log('\n✅ QR Code test completed successfully!');
      }
    });
    
    return qrCodeDataURL;
  } catch (error) {
    console.error('💥 Error generating QR code:', error);
    throw error;
  }
}

testQRCode().catch(console.error);
