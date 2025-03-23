import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';

export async function POST(request: Request) {
  console.log("API route received request");
  
  try {
    let requestData;
    const contentType = request.headers.get('content-type') || '';
    console.log("Content-Type:", contentType);
    
    // Parse request body based on content type
    if (contentType.includes('application/json')) {
      requestData = await request.json();
      console.log("JSON request data:", requestData);
    } else {
      const formData = await request.formData();
      console.log("FormData entries:", [...formData.entries()].map(([key, value]) => 
        typeof value === 'object' && 'name' in value 
          ? `${key}: File(${(value as File).name})` 
          : `${key}: ${value}`
      ));
      
      if (formData.has('color') && formData.has('green_times')) {
        const color = formData.get('color') as string;
        const greenTimesStr = formData.get('green_times') as string;
        let greenTimes;
        
        try {
          greenTimes = JSON.parse(greenTimesStr);
        } catch (e) {
          console.error("Failed to parse green_times JSON:", e);
          return NextResponse.json({
            error: 'Invalid green_times format',
            details: (e as Error).message
          }, { status: 400 });
        }
        
        requestData = { color, green_times: greenTimes };
        console.log("Parsed form data:", requestData);
      } else if (formData.has('file')) {
        // Handle file upload case
        const file = formData.get('file') as File;
        // Rest of file handling logic...
        return NextResponse.json({ error: 'File upload not implemented yet' }, { status: 501 });
      } else {
        console.error("Invalid request: Missing required fields");
        return NextResponse.json({ 
          error: 'Invalid request: Missing required fields',
          receivedFields: [...formData.keys()]
        }, { status: 400 });
      }
    }
    
    // Validate request data
    if (!requestData || !requestData.color || !requestData.green_times) {
      console.error("Missing required fields in request data");
      return NextResponse.json({ 
        error: 'Missing required fields',
        receivedData: requestData 
      }, { status: 400 });
    }
    
    // Mock response for testing when Flask API is not available
    // Remove or comment this section when Flask API is running
    console.log("Returning mock response for testing");
    return NextResponse.json({
      optimized_green_times: [
        Math.round(parseInt(requestData.green_times[0]) * 0.9),
        Math.round(parseInt(requestData.green_times[1]) * 1.1),
        Math.round(parseInt(requestData.green_times[2]) * 1.0)
      ],
      estimated_delay_time: Math.round(45 + Math.random() * 30)
    });
    
    /* Uncomment this section when Flask API is available
    try {
      console.log("Calling Flask API at http://localhost:5001/optimize");
      const response = await axios.post('http://localhost:5001/optimize', requestData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000 // 10 second timeout
      });
      
      console.log("Flask API response:", response.data);
      return NextResponse.json(response.data);
    } catch (apiError) {
      console.error("Error calling Flask API:", apiError);
      
      // Check if the error is from axios
      if (axios.isAxiosError(apiError) && apiError.response) {
        return NextResponse.json({
          error: 'Flask API error',
          status: apiError.response.status,
          data: apiError.response.data
        }, { status: apiError.response.status });
      } else if (axios.isAxiosError(apiError) && apiError.code === 'ECONNREFUSED') {
        return NextResponse.json({
          error: 'Flask API not running or not accessible',
          details: apiError.message
        }, { status: 503 });
      }
      
      return NextResponse.json({
        error: 'Error calling Flask API',
        details: apiError instanceof Error ? apiError.message : String(apiError)
      }, { status: 500 });
    }
    */
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}