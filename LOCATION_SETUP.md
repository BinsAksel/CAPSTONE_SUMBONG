# Location Feature Setup Instructions

## Frontend Setup

### 1. Google Maps API Key
You need to add a Google Maps API key to your frontend environment variables.

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Maps JavaScript API
   - Geocoding API
   - Places API (optional, for enhanced search)

4. Create an API key:
   - Go to "Credentials" in the API & Services section
   - Click "Create Credentials" > "API Key"
   - Restrict the key to your domain for security

5. Add the API key to your frontend environment:

Create or update `.env` in your `frontend` folder:
```
REACT_APP_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

### 2. Features Implemented

The location feature includes:

#### In Complaint Form:
- **Select Location Button**: Replaces the manual location text input
- **Google Maps Integration**: Opens an interactive map when clicked
- **Auto-location**: Requests user's current location (with permission)
- **Manual Selection**: Users can click anywhere on the map to set location
- **Address Geocoding**: Automatically converts coordinates to readable address

#### In Complaint View:
- **Show Location Button**: Appears next to the location text when coordinates are available
- **Map Viewer**: Opens a read-only map showing the pinned location

### 3. Usage Flow

1. **Adding Complaint**:
   - User clicks "Select Location" button
   - Map modal opens with current location (if permission granted)
   - User can drag marker or click new location
   - Address automatically updates based on coordinates
   - User confirms location and it fills the form

2. **Viewing Complaint**:
   - In complaint details, location shows as text
   - "Show Location" button appears if coordinates exist
   - Clicking opens map modal showing the exact pinned location

## Backend Updates Needed

The frontend now sends `locationCoords` as JSON string containing `{lat, lng}`. You may need to update your backend complaint model and handling:

### 1. Update Complaint Model
Add location coordinates field to your Complaint schema:

```javascript
// In your Complaint model
locationCoords: {
  lat: { type: Number, default: null },
  lng: { type: Number, default: null }
}
```

### 2. Update Complaint Route
In your complaint creation endpoint, parse and store coordinates:

```javascript
// In your complaint creation route
if (req.body.locationCoords) {
  try {
    const coords = JSON.parse(req.body.locationCoords);
    complaint.locationCoords = coords;
  } catch (e) {
    console.warn('Invalid locationCoords format:', e);
  }
}
```

## Security Considerations

1. **API Key Restriction**: Restrict your Google Maps API key to your domain
2. **Usage Limits**: Monitor API usage to avoid unexpected charges
3. **Fallback**: The system gracefully handles missing coordinates - location still works as text

## Testing

1. Test with location permissions granted
2. Test with location permissions denied
3. Test manual location selection by clicking map
4. Test viewing saved locations in complaint details
5. Verify coordinates are properly saved and retrieved

## Troubleshooting

1. **Map not loading**: Check if API key is correctly set in .env
2. **Location access denied**: Feature still works, users can manually select
3. **Geocoding fails**: Shows coordinates as fallback address
4. **API limits exceeded**: Consider implementing usage limits or alternative providers

The location feature is now fully integrated into your complaint system!