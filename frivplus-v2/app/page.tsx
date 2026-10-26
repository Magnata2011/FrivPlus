import Link from "next/link";

const features = [
  { icon: "🎮", title: "Uma biblioteca de jogos", description: "Explore jogos por categoria e encontre sua próxima partida favorita." },
  { icon: "☁️", title: "Seus saves na nuvem", description: "Guarde arquivos de save e use sincronização automática nos jogos compatíveis." },
  { icon: "🛡️", title: "Sua conta, seu espaço", description: "Tenha um perfil próprio e mantenha seu progresso separado de outros jogadores." },
];

export default function HomePage() {
  return (
    <>
      <header className="wrap nav">
        <Link className="brand" href="/">Friv<span>Plus</span></Link>
        <nav className="navlinks" aria-label="Navegação principal">
          <a className="optional" href="#recursos">Recursos</a>
          <Link className="btn" href="/login">Entrar</Link>
        </nav>
      </header>
      <main className="wrap">
        <section className="hero">
          <span className="eyebrow">✦ Uma nova experiência de jogos</span>
          <h1>Seu próximo jogo começa no <span className="gradient">FrivPlus.</span></h1>
          <p className="lead">Uma biblioteca de jogos, sua conta pessoal e uma forma mais prática de guardar suas partidas. Tudo em um só lugar.</p>
          <div className="actions">
            <Link className="btn primary" href="/login">Começar agora ↗</Link>
            <a className="btn" href="#recursos">Conhecer recursos</a>
          </div>
        </section>
        <section className="section" id="recursos">
          <div className="sectionhead">
            <div><h2>Feito para jogar melhor.</h2><p className="muted">A base para uma experiência mais organizada.</p></div>
          </div>
          <div className="cards">
            {features.map((feature) => (
              <article className="card" key={feature.title}>
                <div className="symbol" aria-hidden="true">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer className="footer"><div className="wrap">FrivPlus V2 · Um projeto em desenvolvimento.</div></footer>
    </>
  );
}
