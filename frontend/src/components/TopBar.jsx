import { MdMenu } from 'react-icons/md';

export default function TopBar({ setMobileOpen }) {
    return (
        <div className="md:hidden bg-white shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold">
                    S
                </div>
                <h1 className="font-bold text-gray-800">School MS</h1>
            </div>

            <button
                onClick={() => setMobileOpen(true)}
                className="text-gray-600 hover:text-gray-800 transition"
            >
                <MdMenu size={28} />
            </button>
        </div>
    );
}
