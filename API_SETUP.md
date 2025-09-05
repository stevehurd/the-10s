# API Keys Setup for Football Team Data

To get accurate 2025 NFL and college football team data, you need to set up your SportsDataIO API key.

## SportsDataIO (Recommended - Unified Data Source)

1. **Sign Up**: Go to [SportsDataIO Free Trial](https://sportsdata.io/free-trial)
2. **Get API Key**: Complete registration and get your NFL + NCAA Football API key
3. **Add to Environment**: Add this line to your `.env.local` file:
   ```
   SPORTSDATA_API_KEY=your_api_key_here
   ```

**Benefits:**
- ✅ **Single API** for both NFL and college teams
- ✅ **Consistent data format** across leagues  
- ✅ **High-quality logos** from Wikipedia
- ✅ **External team IDs** for game data integration
- ✅ **Professional reliability** for live data

## Testing the Setup

1. **Create .env.local** file in the project root (if it doesn't exist)
2. **Add your API key** using one of the formats above
3. **Restart the development server**: `npm run dev`
4. **Sync teams**: Go to `/admin` and click "Sync Teams" button
5. **Check logs**: You should see successful API calls in the terminal

## Current Status

- **NFL Teams**: ✅ Fetched from SportsDataIO API (32 teams)
- **College Teams**: ✅ Fetched from SportsDataIO API (136 FBS teams)
- **Team Logos**: ✅ High-quality SVG logos from Wikipedia
- **Data Consistency**: ✅ Unified source for all team data

## API Endpoints Used

- **NFL Teams**: `https://api.sportsdata.io/v3/nfl/scores/json/TeamsBasic`
- **College Teams**: `https://api.sportsdata.io/v3/cfb/scores/json/TeamsBasic`

Both endpoints provide consistent team data including:
- Full team names and abbreviations
- Conference and division information  
- External team IDs for game data correlation
- Wikipedia logo URLs for high-quality team logos