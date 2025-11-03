export const dynamic = 'force-dynamic'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm">
        <h1 className="text-4xl font-bold mb-4 text-center">Period Tracker API</h1>
        <p className="text-center text-gray-600">
          Backend API is running. Use the mobile app to interact with the API.
        </p>
        <div className="mt-8 p-6 bg-gray-100 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">API Endpoints:</h2>
          <ul className="space-y-2 text-sm">
            <li>GET /api/user - Get user profile</li>
            <li>GET /api/periods - Get all periods</li>
            <li>POST /api/periods - Create new period</li>
            <li>GET /api/symptoms - Get symptoms</li>
            <li>POST /api/symptoms - Log symptom</li>
            <li>GET /api/moods - Get moods</li>
            <li>POST /api/moods - Log mood</li>
            <li>GET /api/notes - Get notes</li>
            <li>POST /api/notes - Create note</li>
            <li>GET /api/settings - Get settings</li>
            <li>PATCH /api/settings - Update settings</li>
            <li>GET /api/predictions - Get cycle predictions</li>
          </ul>
        </div>
      </div>
    </main>
  )
}

