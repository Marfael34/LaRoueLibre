import React, { useContext, useEffect, useState, useMemo } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { API_ROOT, IMAGE_URL } from '../constants/apiConstant';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom'; 
import ButtonLoader from '../components/Loader/ButtonLoader';
import { FaUser, FaShoppingBag, FaHistory, FaMapMarkerAlt, FaBirthdayCake, FaBoxOpen, FaEdit, FaPhone, FaHeart, FaFileInvoice, FaTrophy, FaIdCard } from 'react-icons/fa';
import CustomButton from '../components/UI/CustomButton';
import EditProfileForm from '../components/Market/EditProfileForm';
import LocationCard from '../components/Card/LocationCard'; 

const Profile = () => {
    const { user, setUser } = useContext(AuthContext);
    const [fullUser, setFullUser] = useState(null);
    const [orders, setOrders] = useState([]);
    const [cart, setCart] = useState(null);
    const [wishlist, setWishlist] = useState([]); 
    const [etatFavorisId, setEtatFavorisId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [showLicenceHistory, setShowLicenceHistory] = useState(false);
    
    const navigate = useNavigate(); 

    const fetchProfileData = async () => {
        if (!user?.token || !user?.id) {
            navigate('/login'); 
            return;
        }

        try {
            const authConfig = { headers: { Authorization: `Bearer ${user.token}` } };

            // Appel API User
            const userRes = await axios.get(`${API_ROOT}/api/users/${user.id}`, authConfig);
            setFullUser(userRes.data);

            // Récupérer les états pour identifier l'ID du label 'Favoris'
            const etatsRes = await axios.get(`${API_ROOT}/api/etats`, authConfig);
            const etatsData = etatsRes.data['hydra:member'] || etatsRes.data.member || [];
            
            const favEtat = etatsData.find(e => e.label === 'Favoris');
            if (favEtat) {
                setEtatFavorisId(favEtat.id);
            }

            // Récupérer la Wishlist
            try {
                const wishlistRes = await axios.get(`${API_ROOT}/api/wishlist/me`, authConfig);
                setWishlist(wishlistRes.data);
            } catch (wishErr) { console.error("Erreur wishlist:", wishErr); }

            // Panier
            const etatEnCours = etatsData.find(e => e.label === "En attentes de paiement" || e.label.toLowerCase().includes("attente"));
            if (etatEnCours) {
                const etatIri = etatEnCours['@id'] || `/api/etats/${etatEnCours.id}`;
                try {
                    const cartRes = await axios.get(
                        `${API_ROOT}/api/paniers?user=/api/users/${user.id}&etat=${etatIri}`,
                        authConfig
                    );
                    const cartData = cartRes.data.member || cartRes.data['hydra:member'] || [];
                    setCart(cartData[0] || null);
                } catch (cartErr) { console.error("Erreur panier:", cartErr); }
            }

            // Commandes
            try {
                const ordersRes = await axios.get(
                    `${API_ROOT}/api/orders?user=/api/users/${user.id}`,
                    authConfig
                );
                const ordersData = ordersRes.data.member || ordersRes.data['hydra:member'] || [];
                setOrders(ordersData);
            } catch (orderErr) { console.error("Erreur commandes:", orderErr); }

        } catch (err) {
            console.error("PROFIL Error:", err);
            setError("Impossible de charger les données du profil.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProfileData();
    }, [user, navigate]);

    // On ne garde que les items de la wishlist dont l'ID d'état correspond à 'Favoris'
    const filteredWishlist = useMemo(() => {
        if (!etatFavorisId) return wishlist; // Si pas encore chargé, on affiche tout par défaut ou rien

        return wishlist.filter(item => {
            // On force la comparaison en Number pour éviter les erreurs de type string/int
            return Number(item.etatId) === Number(etatFavorisId);
        });
    }, [wishlist, etatFavorisId]);

    const aggregatedCartItems = useMemo(() => {
        if (!cart || !cart.items) return [];
        const groups = cart.items.reduce((acc, item) => {
            const product = item.product;
            if (!product) return acc;
            const pid = product.id;
            if (!acc[pid]) {
                acc[pid] = { product: product, quantity: 0, totalPrice: 0 };
            }
            acc[pid].quantity += item.quantity;
            acc[pid].totalPrice += (parseFloat(product.price) || 0) * item.quantity;
            return acc;
        }, {});
        return Object.values(groups);
    }, [cart]);

    const calculateCartTotal = () => {
        return aggregatedCartItems.reduce((total, item) => total + item.totalPrice, 0).toFixed(2);
    };

    const handleUpdateSuccess = (updatedUser) => {
        setIsEditing(false);
        setFullUser(updatedUser);
        setUser({ ...user, ...updatedUser }); 
        fetchProfileData();
    };

    if (!user) return null; 
    if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-dark-nigth-blue"><ButtonLoader size={60} /></div>;
    if (error) return <div className="min-h-screen flex items-center justify-center text-red-500 bg-dark-nigth-blue"><p>{error}</p></div>;

    const formatDate = (dateString) => {
        if (!dateString) return "Non renseignée";
        try {
            return new Date(dateString).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
        } catch (err) { return "Date invalide"; }
    };

    const getStatusStyle = (status) => {
        if (!status) return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        const s = status.toLowerCase();
        
        if (s.includes('payées') || s.includes('validées') || s.includes('livrées')) {
            return 'bg-green-500/20 text-green-400 border-green-500/30';
        }
        if (s.includes('en attente') || s.includes('approuvée') || s.includes('préparation') || s.includes('livraison') || s.includes('paiement')) {
            return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
        }
        if (s.includes('annulée') || s.includes('rejetée')) {
            return 'bg-red-500/20 text-red-400 border-red-500/30';
        }
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    };

    return (
        <div className="bg-dark-nigth-blue min-h-screen pb-10">
            <div className="max-w-7xl mx-auto px-4 py-10 text-white">
                <div className="flex justify-between items-center mb-10">
                    <h1 className="title-h1">Mon Profil</h1>
                    {!isEditing && (
                        <CustomButton onClick={() => setIsEditing(true)} className="py-2! px-4! text-sm">
                            <FaEdit /> Modifier mon profil
                        </CustomButton>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                     {/* COLONNE GAUCHE : INFOS OU FORMULAIRE */}
                    <div className="bg-black/40 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-xl h-fit">
                        {isEditing ? (
                            <EditProfileForm 
                                user={user}
                                fullUser={fullUser}
                                onCancel={() => setIsEditing(false)}
                                onSuccess={handleUpdateSuccess}
                            />
                        ) : (
                            <>
                                <div className="flex flex-col items-center mb-8">
                                    <div className="relative w-32 h-32 mb-4">
                                        <img 
                                            src={fullUser?.avatar ? `${API_ROOT}${fullUser.avatar.startsWith('/') ? '' : '/'}${fullUser.avatar}` : `${IMAGE_URL}/default/avatar/default-avatar-1.png`} 
                                            alt="Avatar" 
                                            className="w-full h-full object-cover rounded-full border-4 border-orange shadow-lg"
                                            onError={(e) => { e.target.onerror = null; e.target.src = `${IMAGE_URL}/default/avatar/default-avatar-1.png`; }}
                                        />
                                    </div>
                                    <h2 className="text-2xl font-bold">{fullUser?.firstname || fullUser?.firstName} {fullUser?.lastname || fullUser?.lastName}</h2>
                                    <p className="text-orange font-medium">@{fullUser?.pseudo}</p>
                                </div>

                                <div className="space-y-5 border-t border-white/10 pt-6">
                                    <div>
                                        <p className="text-gray-400 text-sm">Email</p>
                                        <p className="font-medium">{fullUser?.email}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <FaPhone className="text-orange" size={18} />
                                        <div>
                                            <p className="text-gray-400 text-sm">Téléphone</p>
                                            <p className="font-medium">{fullUser?.telephone || fullUser?.phone || "Non renseigné"}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <FaBirthdayCake className="text-orange" size={18} />
                                        <div>
                                            <p className="text-gray-400 text-sm">Date de naissance</p>
                                            <p className="font-medium">{formatDate(fullUser?.birthday)}</p>
                                        </div>
                                    </div>
                                    <div className="pt-2">
                                        <div className="flex items-center gap-3 mb-3">
                                            <FaMapMarkerAlt className="text-orange" size={18} />
                                            <p className="text-gray-400 text-sm">Mon Adresse</p>
                                        </div>
                                        {fullUser?.adresses && fullUser.adresses.length > 0 ? (
                                            <div className="space-y-3">
                                                {fullUser.adresses.map((adr, index) => (
                                                    <div key={index} className="bg-white/5 p-3 rounded-lg border border-white/5 text-sm">
                                                        <p className="font-medium">{adr.number} {adr.type} {adr.label}</p>
                                                        {adr.complement && <p className="text-gray-400 italic text-xs">{adr.complement}</p>}
                                                        <p className="font-bold text-orange mt-1">{adr.cp} {adr.city}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-gray-500 italic text-sm ml-7">Aucune adresse enregistrée</p>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="lg:col-span-2 space-y-8">
                        {/* LICENCE BMX */}
                        {fullUser?.licences && fullUser.licences.length > 0 && (
                            <div className="bg-nigth-blue p-6 rounded-2xl shadow-lg border border-white/5">
                                <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                                    <h2 className="text-xl font-bold flex items-center gap-3">
                                        <FaFileInvoice className="text-orange" /> Ma Licence BMX
                                    </h2>
                                    {fullUser.licences.length > 1 && (
                                        <button 
                                            onClick={() => setShowLicenceHistory(!showLicenceHistory)}
                                            className="text-xs font-bold text-orange hover:text-white transition-colors flex items-center gap-2 bg-orange/10 px-3 py-1.5 rounded-lg border border-orange/20"
                                        >
                                            <FaHistory /> {showLicenceHistory ? "Masquer l'historique" : `Voir l'historique (${fullUser.licences.length - 1})`}
                                        </button>
                                    )}
                                </div>
                                
                                <div className="space-y-4">
                                    {/* On trie par date décroissante pour avoir la plus récente en premier */}
                                    {[...fullUser.licences]
                                        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                                        .map((lic, idx) => {
                                            const currentStatus = lic.etat?.label || "En attente";
                                            const isActive = lic.isActive;
                                            
                                            // Par défaut on ne montre que la première, sauf si l'historique est activé
                                            if (idx > 0 && !showLicenceHistory) return null;

                                            return (
                                                <div key={lic.id || idx} className={`p-5 rounded-xl border transition-all ${idx === 0 ? 'bg-black/40 border-white/10' : 'bg-black/20 border-white/5 opacity-60 hover:opacity-100'}`}>
                                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                                                        <div>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                 <h3 className="font-bold text-lg text-white">Licence #{lic.id}</h3>
                                                                {idx === 0 && <span className="text-[8px] bg-orange text-white px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">Dernière demande</span>}
                                                            </div>
                                                            <p className="text-xs text-gray-400">Demandée le {formatDate(lic.createdAt)}</p>
                                                        </div>
                                                        <span className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${getStatusStyle(currentStatus)}`}>
                                                            {currentStatus}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm mb-6">
                                                        <div>
                                                            <p className="text-gray-500 uppercase text-[10px] font-bold">Nationalité</p>
                                                            <p className="text-white font-medium">{lic.nationaly}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-gray-500 uppercase text-[10px] font-bold">Formule / Validité</p>
                                                            <div className="flex flex-col">
                                                                <span className="text-orange font-black italic">{lic.price_licence?.label}</span>
                                                                {lic.validUntil && (
                                                                    <span className="text-white font-normal text-[10px] opacity-60">
                                                                        Jusqu'au {formatDate(lic.validUntil)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Signature Section */}
                                                    {lic.signaturePath && (
                                                        <div className="mt-4 pt-4 border-t border-white/5">
                                                            <p className="text-gray-500 uppercase text-[10px] font-bold mb-2">Signature du titulaire</p>
                                                            <div className="bg-white/5 rounded-xl p-2 w-fit">
                                                                <img 
                                                                    src={`${API_ROOT}${lic.signaturePath}`} 
                                                                    alt="Signature" 
                                                                    className="h-12 object-contain filter brightness-200 invert"
                                                                    onError={(e) => { e.target.style.display = 'none'; }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Bouton de paiement si approuvée mais pas encore payée */}
                                                    {!isActive && currentStatus === 'Approuvée' && (
                                                        <button 
                                                            onClick={() => navigate('/checkout', { state: { licenceId: lic.id, type: 'licence' } })}
                                                            className="w-full mt-4 bg-orange text-white py-3 rounded-xl font-bold uppercase italic text-sm transition-all hover:scale-[1.02] shadow-lg shadow-orange/20"
                                                        >
                                                            Régler ma licence ⚡
                                                        </button>
                                                    )}

                                                    {/* Message si rejetée ou annulée */}
                                                    {!isActive && (currentStatus === 'Rejetée' || currentStatus === 'Rejetées' || currentStatus === 'Annulées') && (
                                                        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs italic text-center">
                                                            ⚠️ {currentStatus === 'Annulées' ? 'Votre licence a été annulée par un administrateur.' : 'Votre demande a été rejetée. Veuillez vérifier vos documents ou contacter le support.'}
                                                        </div>
                                                    )}

                                                    {lic.pdfPath && (
                                                        <div className="mt-4 pt-4 border-t border-white/5 flex flex-col gap-3">
                                                            <div className="flex items-center gap-2 text-green-400 text-sm font-bold italic uppercase">
                                                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                                                {isActive ? "Permis Officiel Actif" : "Permis Disponible"}
                                                            </div>
                                                            <Link 
                                                                to={`/profile/licence/${lic.id}`} 
                                                                className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg border border-white/10 transition-all text-xs font-bold"
                                                            >
                                                                <FaIdCard /> Voir & Télécharger mon permis
                                                            </Link>
                                                        </div>
                                                    )}

                                                    {isActive && !lic.pdfPath && (
                                                        <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-green-400 text-sm font-bold italic uppercase">
                                                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                                            Permis Officiel Actif
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}

                        {/* INSCRIPTIONS COMPÉTITIONS */}
                        {fullUser?.competitionRegistrations && fullUser.competitionRegistrations.length > 0 && (
                            <div className="bg-nigth-blue p-6 rounded-2xl shadow-lg border border-white/5">
                                <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                                    <h2 className="text-xl font-bold flex items-center gap-3">
                                        <FaTrophy className="text-orange" /> Mes Inscriptions aux Compétitions
                                    </h2>
                                </div>
                                
                                <div className="space-y-4">
                                    {[...fullUser.competitionRegistrations]
                                        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                                        .map((reg, idx) => (
                                            <div key={reg.id || idx} className="p-5 rounded-xl border bg-black/40 border-white/10 hover:border-orange/30 transition-all">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <h3 className="font-bold text-lg text-white">{reg.competition?.title || "Compétition inconnue"}</h3>
                                                        <p className="text-xs text-gray-400">Inscrit le {formatDate(reg.createdAt)}</p>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2">
                                                        <span className="px-3 py-1 rounded-full border border-orange/30 bg-orange/10 text-orange text-[10px] font-black uppercase tracking-widest">
                                                            {reg.category}
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded-md bg-green-500/20 text-green-400 border border-green-500/30 text-[8px] font-black uppercase tracking-tighter">
                                                            {reg.status || 'Confirmé'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                                                    <div>
                                                        <p className="text-gray-500 uppercase text-[10px] font-bold">Pilote</p>
                                                        <p className="text-white font-medium">{reg.firstName} {reg.lastName}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-500 uppercase text-[10px] font-bold">Club</p>
                                                        <p className="text-white font-medium">{reg.club}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-500 uppercase text-[10px] font-bold">Plaque</p>
                                                        <p className="text-orange font-black italic">{reg.plateNumber}</p>
                                                    </div>
                                                </div>
                                                <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-[10px] text-gray-500 italic">
                                                    <div className="flex items-center gap-2">
                                                        <FaPhone className="text-orange" size={10} />
                                                        <span>Urgence : {reg.emergencyContactName} ({reg.emergencyContactPhone})</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 sm:justify-end">
                                                        <Link 
                                                            to={`/profile/registration/${reg.id}`} 
                                                            state={{ registration: reg }}
                                                            className="bg-orange/20 hover:bg-orange/40 text-orange px-4 py-2 rounded-lg font-black uppercase tracking-widest transition-all border border-orange/20"
                                                        >
                                                            Suivre ma participation
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}

                        {/* PANIER */}
                        <div className="bg-nigth-blue p-6 rounded-2xl shadow-lg border border-white/5">
                            <h2 className="text-xl font-bold flex items-center gap-3 mb-6 border-b border-white/10 pb-4"><FaShoppingBag className="text-orange" /> Mon Panier</h2>
                            {aggregatedCartItems.length > 0 ? (
                                <div>
                                    <div className="space-y-3 mb-6 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                        {aggregatedCartItems.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-white/5">
                                                <div className="flex items-center gap-4">
                                                    <img src={item.product.imagePath ? `${API_ROOT}${item.product.imagePath}` : `${IMAGE_URL}/default/default_product.png`} className="w-12 h-12 object-contain rounded-lg" alt="" />
                                                    <div><p className="font-bold text-sm">{item.product.title} (x{item.quantity})</p></div>
                                                </div>
                                                <div className="font-bold text-orange">{item.totalPrice.toFixed(2) / 100} €</div>
                                            </div>
                                        ))}
                                    </div>
                                    <Link to="/panier" className="main-button block text-center w-full m-0! py-3! text-sm">Finaliser l'achat</Link>
                                </div>
                            ) : <p className="text-gray-400 italic text-center">Panier vide.</p>}
                        </div>

                        {/* COMMANDES */}
                        <div className="bg-nigth-blue p-6 rounded-2xl shadow-lg border border-white/5">
                            <h2 className="text-xl font-bold flex items-center gap-3 mb-6 border-b border-white/10 pb-4"><FaHistory className="text-orange" /> Mes Commandes</h2>
                            {orders.length > 0 ? (
                                <div className="space-y-4">
                                    {orders.map((order) => {
                                        const currentStatus = order.etats?.length > 0 ? order.etats[order.etats.length - 1].label : "En attente";
                                        return (
                                            <div key={order.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-black/40 p-5 rounded-xl border border-white/5 hover:border-orange/30 transition-colors gap-4">
                                                <div>
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <h3 className="font-bold text-lg text-white">Commande ORD-{order.id.toString().padStart(5, '0')}</h3>
                                                        <span className="text-xs text-gray-400">{formatDate(order.created_at || order.createdAt)}</span>
                                                    </div>
                                                    <div className="mt-3">
                                                        <span className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${getStatusStyle(currentStatus)}`}>
                                                            {currentStatus}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="w-full sm:w-auto mt-2 sm:mt-0 flex flex-col sm:flex-row gap-3">
                                                    <Link 
                                                        to={`/profile/order/${order.id}`} 
                                                        state={{ order }} 
                                                        className="bg-orange hover:bg-orange/80 text-black font-bold py-2.5 px-6 rounded-lg transition-colors text-sm w-full sm:w-auto block text-center shadow-lg whitespace-nowrap"
                                                    >
                                                        {currentStatus === 'Livrées' ? 'Voir la commande' : 'Suivre la commande'}
                                                    </Link>
                                                    {currentStatus === 'Livrées' && (
                                                        <Link 
                                                            to={`/invoice/${order.id}`} 
                                                            className="bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 px-6 rounded-lg transition-colors text-sm w-full sm:w-auto border border-white/20 shadow-lg whitespace-nowrap flex items-center justify-center gap-2"
                                                        >
                                                            <FaFileInvoice /> Facture
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : <p className="text-gray-400 italic text-center py-6">Aucune commande pour le moment.</p>}
                        </div>

                        {/* --- SECTION WISHLIST --- */}
                        <div className="bg-nigth-blue p-6 rounded-2xl border border-white/10">
                            <h2 className="text-2xl font-bold flex items-center gap-3 mb-8 border-b border-white/10 pb-4">
                                <FaHeart className="text-orange" /> Ma Wishlist
                            </h2>
                            {filteredWishlist.length > 0 ? (
                                <div className="flex flex-col gap-6">
                                    {filteredWishlist.map((item) => (
                                        <div key={item.id} className="bg-black/40 backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-xl">
                                            <div className="flex flex-col gap-3">
                                                {/* Affichage des données de la wishlist */}
                                                <h3 className="text-xl font-bold text-white">{item.productName || item.placeName || "Élément sans nom"}</h3>
                                                
                                                <div className="flex justify-between items-center mt-2">
                                                    <span className="text-orange font-medium">
                                                        {item.placeDifficulty ? `Difficulté : ${item.placeDifficulty}` : (item.productPrice ? `${item.productPrice / 100} €` : "Favori")}
                                                    </span>
                                                    <span className="text-gray-400 text-xs">Ajouté le {item.createdAt}</span>
                                                </div>
                                                
                                                {/* Lien vers le détail si nécessaire, utilisant l'id de la wishlist ou du produit lié */}
                                                <Link 
                                                    to={item.productId ? `/product/${item.productId}` : `/location/${item.placeId}`} 
                                                    className="mt-4 text-center bg-orange/20 hover:bg-orange/40 text-orange py-2 rounded-lg transition-all border border-orange/50 text-sm font-bold"
                                                >
                                                    Voir le détail
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-black/20 p-10 rounded-2xl border border-dashed border-white/10 flex flex-col items-center gap-4">
                                    <p className="text-gray-400 text-lg">Votre wishlist est vide.</p>
                                    <Link to="/market" className="text-orange hover:underline font-medium">Parcourir le catalogue</Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                
            </div>
        </div>
    );
};

export default Profile;