import dotenv from 'dotenv';
import { generateUploadUrl, deleteFromOCI } from './src/oci/client.js';

dotenv.config();

async function testOCI() {
    console.log('Testing OCI Upload & Delete\n');
    
    console.log('Environment Variables:');
    console.log('   OCI_NAMESPACE:', process.env.OCI_NAMESPACE);
    console.log('   OCI_BUCKET_NAME:', process.env.OCI_BUCKET_NAME);
    console.log('   OCI_REGION:', process.env.OCI_REGION);
    console.log('');

    if (!process.env.OCI_NAMESPACE || !process.env.OCI_BUCKET_NAME) {
        console.error('Missing required environment variables');
        console.error('Please set OCI_NAMESPACE and OCI_BUCKET_NAME in .env');
        process.exit(1);
    }

    try {
        console.log('Generating upload URL...');
        const uploadResult = await generateUploadUrl('test-file.mp3');
        console.log('Upload URL generated');
        console.log('   Object Name:', uploadResult.objectName);
        console.log('   Expires At:', uploadResult.expiresAt);
        console.log('');

        const testContent = 'This is a test file for OCI upload/delete';
        const blob = new Blob([testContent], { type: 'audio/mpeg' });
        
        console.log('Uploading test file...');
        const uploadResponse = await fetch(uploadResult.uploadUrl, {
            method: 'PUT',
            body: blob,
            headers: {
                'Content-Type': 'audio/mpeg'
            }
        });

        if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.status}`);
        }
        console.log('File uploaded\n');

        console.log('Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('Deleting file...');
        await deleteFromOCI(uploadResult.objectName);
        console.log('File deleted\n');

        console.log('All tests passed');
        process.exit(0);

    } catch (error) {
        console.error('Test failed:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
        process.exit(1);
    }
}

testOCI();
