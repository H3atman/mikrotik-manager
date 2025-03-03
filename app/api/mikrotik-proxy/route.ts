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
    
    const options: {
      method: string;
      url: string;
      headers: {
        Authorization: string;
        'Content-Type': string;
      };
      timeout: number;
      validateStatus: (status: number) => boolean;
      data?: Record<string, unknown>;
    } = {
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
      let body: Record<string, unknown>;
      try {
        body = await request.json();
        console.log('Request body:', body);
        
        // Special handling for PPP secret updates with comment field
        if (url.includes('/ppp/secret/') && method === 'PATCH' && 'comment' in body) {
          console.log('Detected PPP secret update with comment field');
          
          // Ensure comment is a string or can be converted to a string
          const comment = body.comment;
          if (comment !== null && comment !== undefined) {
            body.comment = String(comment);
            
            // Limit comment length
            if (typeof body.comment === 'string' && body.comment.length > 255) {
              body.comment = body.comment.substring(0, 255);
              console.warn('Comment truncated to 255 characters');
            }
            
            // Escape special characters
            if (typeof body.comment === 'string') {
              body.comment = body.comment
                .replace(/"/g, '')
                .replace(/'/g, '')
                .replace(/\\/g, '');
              
              console.log('Sanitized comment:', body.comment);
            }
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
    } catch (axiosError: unknown) {
      const error = axiosError as Error & { response?: { status: number; data: unknown } };
      console.error('Axios error:', error.message);
      
      // Special handling for PPP secret updates with comment field
      if (url.includes('/ppp/secret/') && method === 'PATCH' && 
          options.data && 'comment' in options.data && 
          error.response?.status === 400) {
        
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
            } catch {
              console.log('Comment update failed, but other fields were updated');
            }
            
            return NextResponse.json(response1.data);
          } catch (alternativeError: unknown) {
            const error = alternativeError as Error & { message: string };
            console.error('Alternative approach failed:', error.message);
          }
        }
      }
      
      throw error; // Re-throw to be caught by the outer catch
    }
  } catch (error: unknown) {
    const err = error as Error & { 
      response?: { 
        status: number; 
        statusText: string; 
        data: unknown 
      };
      message: string;
    };
    console.error('Proxy error:', err);
    
    // Provide more detailed error information
    const errorResponse = {
      error: err.message || 'Proxy request failed',
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data,
      url: url // Include the URL that failed
    };
    
    // Log the full error for debugging
    console.error('Full error details:', JSON.stringify(errorResponse, null, 2));
    
    return NextResponse.json(
      errorResponse,
      { status: err.response?.status || 500 }
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