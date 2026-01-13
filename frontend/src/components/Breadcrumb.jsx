import { MdHome, MdChevronRight } from 'react-icons/md';
import { Link } from 'react-router-dom';

export default function Breadcrumb({ items }) {
    return (
        <nav className="breadcrumb">
            <Link to="/" className="breadcrumb-item hover:text-primary-600 transition">
                <MdHome size={16} />
                <span>Home</span>
            </Link>

            {items && items.map((item, index) => (
                <div key={index} className="breadcrumb-item">
                    <MdChevronRight className="breadcrumb-separator" size={16} />
                    {item.link ? (
                        <Link to={item.link} className="hover:text-primary-600 transition">
                            {item.label}
                        </Link>
                    ) : (
                        <span className="text-gray-800 font-medium">{item.label}</span>
                    )}
                </div>
            ))}
        </nav>
    );
}
