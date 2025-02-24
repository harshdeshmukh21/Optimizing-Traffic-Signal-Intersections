import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const intersectionType = formData.get('intersectionType') as string;
    
    // Create temporary directory for file upload if it doesn't exist
    const uploadDir = path.join(process.cwd(), 'tmp');
    await fs.mkdir(uploadDir, { recursive: true });
    
    // Save uploaded file
    const filePath = path.join(uploadDir, file.name);
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, fileBuffer);
    
    // Run Python script
    const pythonProcess = spawn('python', [
      path.join(process.cwd(), 'lib/optimizer/traffic_signal_optimizer.py'),
      '--input', filePath,
      '--type', intersectionType
    ]);

    return new Promise((resolve, reject) => {
      let outputData = '';
      
      pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
      });

      pythonProcess.on('close', (code) => {
        // Clean up temporary file
        fs.unlink(filePath).catch(console.error);
        
        if (code === 0) {
          try {
            const results = JSON.parse(outputData);
            resolve(NextResponse.json(results));
          } catch (error) {
            reject(new Error('Failed to parse Python output'));
          }
        } else {
          reject(new Error(`Python process exited with code ${code}`));
        }
      });
    });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Failed to process file' },
      { status: 500 }
    );
  }
}