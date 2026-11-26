
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import "./Home.css";
import { Link } from "react-router-dom";

function Home() {
  return (
    <div className="nykaa-home container-fluid px-0">

      {/* REUSABLE NAVBAR */}
      <Navbar />

      <main>

        {/* MAIN DIWALI BANNER */}
        <section className="hero-banner">
          <img
            src="/image/Home-banner.png"
            alt="Sabkoo - Discover Your Style"
            className="img-fluid w-100 d-block"
          />
        </section>

        {/* PROMOTIONAL BANNER */}
        <section
          className="offer-banner d-flex justify-content-center align-items-center text-center"
          id="offers"
        >
          <div>
            <h2>SABKOO LUXE</h2>
            <p>EXCLUSIVE OFFERS ON YOUR FAVOURITES</p>
            <Link to="/products" className="text-decoration-none">
            <strong>SHOP NOW</strong>
            </Link>
          </div>
        </section>

        {/* SHOP BY CATEGORY */}
        <section
          className="home-section container-fluid text-center"
          id="categories"
        >
          <h2 className="category-heading">Explore Your Style</h2>
          <p>Discover fashion for every occasion</p>

          <div className="category-cards row g-4 justify-content-center">

            {/* WOMEN'S COLLECTION */}
            <div className="col-6 col-lg-4">
              <div className="shop-card">
                <img
                  src="/image/women-collection.png"
                  alt="Women's Collection"
                />

                <h3>Women's Collection</h3>
                <Link to="/products?category=women">
                Explore Now
                </Link>
              </div>
            </div>

            {/* MEN'S COLLECTION */}
            <div className="col-6 col-lg-4" id="men">
              <div className="shop-card">
               <img
                  src="/image/men-collection.png"
                  alt="Men's Collection"
                />

                <h3>Men's Collection</h3>
                <Link to="/products?category=men">
                  Explore Now
                </Link>
              </div>
            </div>

            {/* NEW ARRIVALS */}
            <div className="col-6 col-lg-4" id="brands">
              <div className="shop-card">
               <img
                  src="/image/new-arrivals.png"
                  alt="New Arrivals"
                />

                <h3>New Arrivals</h3>
                <Link to="/products?sort=newest">
                Explore Now
              </Link>
              </div>
            </div>

          </div>
        </section>

      </main>

      {/* REUSABLE FOOTER INCLUDING SOCIAL MEDIA */}
      <Footer />

    </div>
  );
}

export default Home;
