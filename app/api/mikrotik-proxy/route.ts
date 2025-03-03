import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// Helper function to handle proxy requests
async function handleProxyRequest(request: NextRequest, method: string) {
  const url = request.nextUrl.searchParams.get('url');
  const authorization = request.headers.get('Authorization');
  
  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }
  
  try {
    console.log(`Proxying ${method} request to: ${url}`);
    
    const options: any = {
      method,
      url,
      headers: {
        'Authorization': authorization || '',
        'Content-Type': 'application/json',
      },
      timeout: 15000, // Increase timeout to 15 seconds
      validateStatus: (status: number) => status < 500 // Allow 400-level responses to be handled
    };
    
    // Add body for methods that support it
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      let body: Record<string, any>;
      try {
        body = await request.json();
        console.log('Request body:', body);
        
        // Special handling for PPP secret updates with comment field
        if (url.includes('/ppp/secret/') && method === 'PATCH' && 'comment' in body) {
          console.log('Detected PPP secret update with comment field');
          
          // Ensure comment is a string
          if (body.comment !== null && body.comment !== undefined) {
            body.comment = String(body.comment);
            
            // Limit comment length
            if (body.comment.length > 255) {
              body.comment = body.comment.substring(0, 255);
              console.warn('Comment truncated to 255 characters');
            }
            
            // Escape special characters
            body.comment = body.comment
              .replace(/"/g, '')
              .replace(/'/g, '')
              .replace(/\\/g, '');
            
            console.log('Sanitized comment:', body.comment);
          }
        }
        
        // For PATCH requests, ensure we're sending a valid body
        if (method === 'PATCH') {
          // Remove any undefined or null values
          Object.keys(body).forEach(key => {
            if (body[key] === undefined || body[key] === null) {
              delete body[key];
            }
          });
          
          // Ensure we have at least one valid property
          if (Object.keys(body).length === 0) {
            return NextResponse.json(
              { error: 'PATCH request must include at least one property to update' },
              { status: 400 }
            );
          }
        }
        
        options.data = body;
      } catch (parseError) {
        console.error('Error parsing request body:', parseError);
        return NextResponse.json(
          { error: 'Invalid JSON in request body' },
          { status: 400 }
        );
      }
    }
    
    // Make the request
    try {
      const response = await axios(options);
      
      // Log response status for debugging
      console.log(`Proxy response status: ${response.status}`);
      
      // Handle 400-level responses
      if (response.status >= 400 && response.status < 500) {
        console.warn(`Received ${response.status} from MikroTik API:`, response.data);
        return NextResponse.json(
          {
            error: `MikroTik API returned ${response.status}`,
            details: response.data
          },
          { status: response.status }
        );
      }
      
      return NextResponse.json(response.data);
    } catch (axiosError: any) {
      console.error('Axios error:', axiosError.message);
      
      // Special handling for PPP secret updates with comment field
      if (url.includes('/ppp/secret/') && method === 'PATCH' && 
          options.data && 'comment' in options.data && 
          axiosError.response?.status === 400) {
        
        console.log('Trying alternative approach for PPP secret update...');
        
        // Try updating without the comment field
        const dataWithoutComment = { ...options.data };
        delete dataWithoutComment.comment;
        
        if (Object.keys(dataWithoutComment).length > 0) {
          try {
            // First update without the comment
            const response1 = await axios({
              ...options,
              data: dataWithoutComment
            });
            
            console.log('Update without comment succeeded');
            
            // Then try to update just the comment
            try {
              await axios({
                ...options,
                data: { comment: options.data.comment }
              });
              console.log('Comment update succeeded');
            } catch (commentError) {
              console.log('Comment update failed, but other fields were updated');
            }
            
            return NextResponse.json(response1.data);
          } catch (alternativeError: any) {
            console.error('Alternative approach failed:', alternativeError.message);
          }
        }
      }
      
      throw axiosError; // Re-throw to be caught by the outer catch
    }
  } catch (error: any) {
    console.error('Proxy error:', error);
    
    // Provide more detailed error information
    const errorResponse = {
      error: error.message || 'Proxy request failed',
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: url // Include the URL that failed
    };
    
    // Log the full error for debugging
    console.error('Full error details:', JSON.stringify(errorResponse, null, 2));
    
    return NextResponse.json(
      errorResponse,
      { status: error.response?.status || 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleProxyRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
  return handleProxyRequest(request, 'POST');
}

export async function PUT(request: NextRequest) {
  return handleProxyRequest(request, 'PUT');
}

export async function PATCH(request: NextRequest) {
  return handleProxyRequest(request, 'PATCH');
}

export async function DELETE(request: NextRequest) {
  return handleProxyRequest(request, 'DELETE');
} 