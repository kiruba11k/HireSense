import Sidebar from "../components/Sidebar";

export default function Dashboard() {
  return (
    <div className="flex flex-col md:flex-row min-h-screen text-white">
      
      {/* Sidebar */}
      <div className="md:w-64 w-full">
        <Sidebar />
      </div>

      {/* Content */}
      <div className="flex-1 p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1,2,3].map((i) => (
          <div key={i} className="bg-black/40 p-6 rounded-xl">
            Card {i}
          </div>
        ))}
      </div>
    </div>
  );
}
