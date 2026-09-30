import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import almaxLogo from "../../assets/almax-logo-horizontal.png";

const LOGIN_URL = "/bms/login";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);

      // Scrollspy active section detection
      const sections = ["home", "features", "solutions", "pricing", "contact"];
      const scrollPosition = window.scrollY + 160; // offset for better transition detection

      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", onScroll);
    // Initial check on load
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = ["Home", "Features", "Solutions", "Pricing", "Contact"];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/95 backdrop-blur-md shadow-lg" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <a href="#home" className="flex items-center">
          <img src={almaxLogo} alt="AlMax" className="h-8 w-auto" />
        </a>

        <div className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase()}`}
              className={`transition-colors duration-200 font-medium ${
                activeSection === link.toLowerCase()
                  ? "text-[#4F46E5] font-bold"
                  : "text-[#475569] hover:text-[#4F46E5]"
              }`}
            >
              {link}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <a 
            href={LOGIN_URL}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#4F46E5] to-[#6366F1] text-white font-semibold hover:opacity-90 transition-all duration-200 shadow-md shadow-indigo-200"
          >
            Login
          </a>
        </div>

        <button className="md:hidden text-[#1E1B4B]" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 flex flex-col gap-4">
          {links.map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase()}`}
              className={`font-medium ${
                activeSection === link.toLowerCase()
                  ? "text-[#4F46E5] font-bold"
                  : "text-[#475569]"
              }`}
              onClick={() => setMenuOpen(false)}
            >
              {link}
            </a>
          ))}
          <a 
            href={LOGIN_URL}
            className="w-full text-center px-5 py-2 rounded-lg bg-gradient-to-r from-[#4F46E5] to-[#6366F1] text-white font-semibold"
          >
            Login
          </a>
        </div>
      )}
    </nav>
  );
}
