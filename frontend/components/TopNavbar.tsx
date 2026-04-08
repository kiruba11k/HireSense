type Props = {
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;
  onMenuToggle?: () => void;
};

export default function TopNavbar({ theme, setTheme, onMenuToggle }: Props) {
  return (
    <div className="top-nav glass-panel">
      <button className="icon-btn mobile-menu-btn" onClick={onMenuToggle} title="Open menu">
        <i className="fa-solid fa-bars" />
      </button>
      <div className="search-wrap">
        <i className="fa-solid fa-magnifying-glass" />
        <input placeholder="Search company, agent, signal..." />
      </div>

      <div className="nav-actions">
        <button className="icon-btn" title="Saved Queries">
          <i className="fa-regular fa-bookmark" />
        </button>
        <button className="icon-btn" title="History">
          <i className="fa-solid fa-clock-rotate-left" />
        </button>
        <button className="icon-btn" title="Notifications">
          <i className="fa-regular fa-bell" />
          <span className="notif-dot" />
        </button>
        <button className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          <i className={`fa-solid ${theme === "dark" ? "fa-sun" : "fa-moon"}`} />
        </button>
        <button className="profile-btn">
          <div className="avatar">HS</div>
          <div>
            <strong>Team Workspace</strong>
            <small>Signed in</small>
          </div>
          <i className="fa-solid fa-chevron-down" />
        </button>
      </div>
    </div>
  );
}
