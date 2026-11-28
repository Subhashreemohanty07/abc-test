import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import "./Home.css";
import { Link } from "react-router-dom";

function Home() {
  const categories = [
    {
      id: "women",
      title: "Women's Collection",
      image: "/image/women-collection.png",
      link: "/products?category=women",
    },
    {
      id: "men",
      title: "Men's Collection",
      image: "/image/men-collection.png",
      link: "/products?category=men",
    },
    {
      id: "brands",
      title: "New Arrivals",
      image: "/image/new-arrivals.png",
      link: "/products?sort=newest",
    },
  ];

  return (
    <div className="nykaa-home w-100 min-vh-100 bg-white">

      {/* REUSABLE NAVBAR */}
      <Navbar />

      <main className="w-100">

        {/* MAIN BANNER */}
        <section className="hero-banner w-100 m-0 p-0">
          <img
            src="/image/Home-banner.png"
            alt="Sabkoo - Discover Your Style"
            className="img-fluid w-100 d-block"
          />
        </section>

        {/* PROMOTIONAL BANNER */}
        <section
          className="offer-banner d-flex justify-content-center align-items-center text-center p-3 p-md-4 my-3 my-lg-4 mx-auto"
          id="offers"
        >
          <div className="w-100">

            <h2 className="fw-bold mb-2">
              SABKOO LUXE
            </h2>

            <p className="mb-3">
              EXCLUSIVE OFFERS ON YOUR FAVOURITES
            </p>

            <Link
              to="/products"
              className="text-decoration-none"
            >
              <strong>SHOP NOW</strong>
            </Link>

          </div>
        </section>

        {/* SHOP BY CATEGORY */}
        <section
          className="home-section container-fluid text-center px-3 px-md-4 px-lg-5 py-4 py-lg-5"
          id="categories"
        >

          <h2 className="category-heading fw-bold mb-2">
            Explore Your Style
          </h2>

          <p className="text-secondary mb-4">
            Discover fashion for every occasion
          </p>

          <div className="category-cards row g-3 g-lg-4 justify-content-center mx-auto">

            {categories.map((category) => (
              <div
                key={category.id}
                id={category.id}
                className="col-6 col-md-4"
              >
                <div className="shop-card h-100 d-flex flex-column overflow-hidden">

                  <img
                    src={category.image}
                    alt={category.title}
                    className="img-fluid w-100 d-block"
                    loading="lazy"
                  />

                  <div className="d-flex flex-column flex-grow-1 align-items-center px-2 px-md-3 pt-3">

                    <h3 className="mb-3">
                      {category.title}
                    </h3>

                    <Link
                      to={category.link}
                      className="mt-auto text-decoration-none"
                    >
                      Explore Now
                    </Link>

                  </div>

                </div>
              </div>
            ))}

          </div>
        </section>

      </main>

      {/* REUSABLE FOOTER */}
      <Footer />

    </div>
  );
}

export default Home;