import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { API_ROOT, IMAGE_URL } from '../constants/apiConstant';
import { AuthContext } from '../contexts/AuthContext';
import ButtonLoader from '../components/Loader/ButtonLoader';
import { FaChevronLeft, FaEdit, FaShoppingCart, FaHeart, FaRegHeart } from 'react-icons/fa';
import AddToCartModal from '../components/UI/AddToCartModal';

const ProductDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    
    const [cart, setCart] = useState(null);
    const [product, setProduct] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // 2. State pour contrôler l'affichage de la modale
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false);
    const [etatFavorisId, setEtatFavorisId] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const productRes = await axios.get(`${API_ROOT}/api/products/${id}`);
                setProduct(productRes.data);

                if (user?.token && user?.id) {
                    const authConfig = { headers: { Authorization: `Bearer ${user.token}` } };
                    const etatsRes = await axios.get(`${API_ROOT}/api/etats`, authConfig);
                    const etats = etatsRes.data.member || etatsRes.data['hydra:member'] || [];

                    // Pour le panier
                    const etatCible = etats.find(e => e.label.toLowerCase().includes("attente"));
                    if (etatCible) {
                        const cartRes = await axios.get(
                            `${API_ROOT}/api/paniers?user=/api/users/${user.id}&etat=${etatCible['@id']}`,
                            authConfig
                        );
                        const cartsData = cartRes.data.member || cartRes.data['hydra:member'] || [];
                        if (cartsData.length > 0) {
                            setCart(cartsData[0]); 
                        }
                    }

                    // Pour la wishlist
                    const favStatus = etats.find(e => e.label === 'Favoris');
                    if (favStatus) setEtatFavorisId(favStatus.id);

                    const wishRes = await axios.get(`${API_ROOT}/api/wishlist/me`, authConfig);
                    const isFav = wishRes.data.some(item => Number(item.productId) === Number(id));
                    setIsFavorite(isFav);
                }
            } catch (error) {
                console.error("Erreur API :", error);
                setError("Impossible de charger le produit.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [id, user]);

    const handleToggleWishlist = async () => {
        if (!user?.token) return navigate('/login');

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const response = await axios.post(
                `${API_ROOT}/api/wishlist/toggle/product/${id}`, 
                { etatId: etatFavorisId }, 
                config
            );
            setIsFavorite(response.data.isFavorite);
        } catch (err) {
            console.error("Erreur lors du toggle wishlist:", err);
        }
    };

    const handleAddToCart = async () => {
        if (!user || !user.token) {
            navigate('/login');
            return;
        }

        if (product.quantity <= 0) {
            alert("Désolé, ce produit est en rupture de stock.");
            return;
        }

        try {
            const authConfig = { 
                headers: { 
                    Authorization: `Bearer ${user.token}`,
                    'Content-Type': 'application/ld+json' 
                } 
            };

            const etatsRes = await axios.get(`${API_ROOT}/api/etats`, authConfig);
            const etats = etatsRes.data.member || etatsRes.data['hydra:member'] || [];
            
            const etatEnAttente = etats.find(e => 
                e.label === "En attentes de paiement" || 
                e.label.toLowerCase().includes("attente")
            );

            if (!etatEnAttente) {
                alert("Erreur : État de panier introuvable.");
                return;
            }

            const etatIri = etatEnAttente['@id'];
            const productIri = product['@id'] || `/api/products/${product.id}`;

            let currentCart = cart;

            if (!currentCart) {
                const panierRes = await axios.get(
                    `${API_ROOT}/api/paniers?user=/api/users/${user.id}&etat=${etatIri}`,
                    authConfig
                );
                const paniersExistants = panierRes.data.member || panierRes.data['hydra:member'] || [];
                
                if (paniersExistants.length > 0) {
                    currentCart = paniersExistants[0];
                } else {
                    const newPanierRes = await axios.post(`${API_ROOT}/api/paniers`, 
                        { user: `/api/users/${user.id}`, etat: etatIri }, 
                        authConfig
                    );
                    currentCart = newPanierRes.data;
                }
                setCart(currentCart);
            }

            const existingItem = currentCart.items?.find(item => {
                const itemProdIri = item.product['@id'] || `/api/products/${item.product.id}`;
                return itemProdIri === productIri;
            });

            if (existingItem) {
                await axios.patch(`${API_ROOT}/api/panier_items/${existingItem.id}`, 
                    { quantity: existingItem.quantity + 1 },
                    { headers: { ...authConfig.headers, 'Content-Type': 'application/merge-patch+json' } }
                );
                // On ouvre la modale au lieu du vieux 'alert'
                setIsModalOpen(true);
            } else {
                await axios.post(`${API_ROOT}/api/panier_items`, 
                    {
                        panier: `/api/paniers/${currentCart.id}`,
                        product: productIri,
                        quantity: 1
                    },
                    authConfig
                );
                // On ouvre la modale au lieu du vieux 'alert'
                setIsModalOpen(true);
            }

            const updatedCartRes = await axios.get(`${API_ROOT}/api/paniers/${currentCart.id}`, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            setCart(updatedCartRes.data);

        } catch (error) {
            console.error("Erreur lors de l'ajout :", error.response?.data || error);
            alert("Une erreur est survenue lors de l'ajout au panier.");
        }
    };

    const getRolesFromToken = (token) => {
        if (!token) return [];
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
            return JSON.parse(jsonPayload).roles || [];
        } catch (error) { return []; }
    };

    const isAdmin = getRolesFromToken(user?.token).includes("ROLE_ADMIN");

    if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-dark-nigth-blue"><ButtonLoader size={60} /></div>;
    if (error) return <div className="min-h-screen flex items-center justify-center text-white bg-dark-nigth-blue"><p>{error}</p></div>;
    if (!product) return null; 

    return (
        <div className="bg-dark-nigth-blue min-h-screen pb-10 text-white relative">
            <div className="max-w-6xl mx-auto px-4 py-8">
                <button onClick={() => navigate('/market')} className="flex items-center gap-2 text-gray-400 hover:text-orange mb-8 transition-colors">
                    <FaChevronLeft /> Retour au catalogue
                </button>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 bg-black/30 p-8 rounded-3xl border border-white/10 shadow-2xl">
                    <div className="flex items-center justify-center bg-white/5 rounded-2xl p-4">
                        <img 
                            src={product.imagePath ? (product.imagePath.startsWith('/') ? `${API_ROOT}${product.imagePath}` : `${API_ROOT}/images/products/${product.imagePath}`) : `${IMAGE_URL}/default/default_product.png`} 
                            alt={product.title}
                            className="max-h-125 object-contain rounded-xl"
                            onError={(e) => { e.target.src = `${IMAGE_URL}/default/default_product.png`; }}
                        />
                    </div>

                    <div className="flex flex-col">
                        <span className="text-orange font-bold uppercase tracking-wider text-sm mb-2">{product.brand || "LaRoueLibre"}</span>
                        <div className="flex justify-between items-start">
                            <h1 className="text-4xl font-bold mb-4">{product.title}</h1>
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleToggleWishlist}
                                    className="p-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full hover:scale-110 transition-all"
                                    title="Ajouter à la wishlist"
                                >
                                    {isFavorite ? <FaHeart className="text-red-500 text-2xl" /> : <FaRegHeart className="text-white text-2xl" />}
                                </button>
                                {isAdmin && (
                                    <Link to={`/product/edit/${product.id}`} className="bg-orange text-black p-3 rounded-full hover:scale-110 transition shadow-lg">
                                        <FaEdit size={20} />
                                    </Link>
                                )}
                            </div>
                        </div>
                        
                        <p className="text-3xl font-bold text-orange mb-2">{product.price / 100} €</p>
                        
                        <div className={`mb-6 font-bold ${product.quantity > 0 ? 'text-green-400' : 'text-red-500'}`}>
                            {product.quantity > 0 ? `En stock : ${product.quantity} unité(s)` : 'Rupture de stock'}
                        </div>
                        
                        <div className="border-t border-white/10 pt-6 mb-6">
                            <h3 className="text-lg font-semibold mb-3 text-gray-300">Description</h3>
                            <p className="text-gray-400 leading-relaxed">{product.description || "Aucune description."}</p>
                        </div>

                        <button 
                            onClick={handleAddToCart}
                            disabled={product.quantity <= 0}
                            className={`mt-auto flex items-center justify-center gap-3 w-full py-4 rounded-xl font-bold transition-all ${product.quantity <= 0 ? 'bg-gray-600 cursor-not-allowed' : 'bg-orange text-black hover:scale-105'}`}
                        >
                            <FaShoppingCart /> {product.quantity > 0 ? 'Ajouter au panier' : 'Indisponible'}
                        </button>
                    </div>
                </div>
            </div>

            {/*  composant de la modale à la toute fin de la page */}
            <AddToCartModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                product={product} 
            />
        </div>
    );
};

export default ProductDetail;