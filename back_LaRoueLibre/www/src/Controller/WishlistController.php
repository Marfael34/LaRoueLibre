<?php

namespace App\Controller;

use App\Entity\Places;
use App\Entity\Wishlist;
use App\Entity\Products;
use App\Repository\EtatRepository;
use App\Repository\WishlistRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/wishlist', name: 'api_wishlist_')]
class WishlistController extends AbstractController
{
    #[Route('/me', name: 'my_wishlist', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    public function getUserWishlist(WishlistRepository $wishlistRepository): JsonResponse
    {
        $user = $this->getUser();
        $wishlistItems = $wishlistRepository->findBy(['user' => $user]);

        $data = array_map(function(Wishlist $item) {
            $place = $item->getPlace();
            $product = $item->getProduct();
            
            $res = [
                'id' => $item->getId(),
                'etatId' => $item->getEtat()->getId(),
                'createdAt' => $item->getCreatedAt() ? $item->getCreatedAt()->format('d/m/Y H:i') : null,
            ];

            if ($place) {
                $res['placeId'] = $place->getId();
                $res['placeName'] = $place->getName();
                $res['placeDescription'] = $place->getDescription();
                $res['placeImg'] = $place->getPath();
                $res['placeDifficulty'] = $place->getDifficulty();
            }

            if ($product) {
                $res['productId'] = $product->getId();
                $res['productName'] = $product->getTitle();
                $res['productDescription'] = $product->getDescription();
                $res['productImg'] = $product->getImagePath();
                $res['productPrice'] = $product->getPrice();
            }

            return $res;
        }, $wishlistItems);

        return new JsonResponse($data, Response::HTTP_OK);
    }

    #[Route('/toggle/{id}', name: 'toggle', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    public function toggle(Places $place, EntityManagerInterface $em, WishlistRepository $repo, EtatRepository $etatRepo): JsonResponse 
    {
        $user = $this->getUser();
        $item = $repo->findOneBy(['user' => $user, 'place' => $place]);

        if ($item) {
            $em->remove($item);
            $em->flush();
            return new JsonResponse(['isFavorite' => false]);
        }

        $etat = $etatRepo->findOneBy(['label' => 'Favoris']);
        
        if (!$etat) {
            return new JsonResponse(['error' => 'État Favoris non trouvé'], Response::HTTP_INTERNAL_SERVER_ERROR);
        }

        $new = new Wishlist();
        $new->setUser($user);
        $new->setPlace($place);
        $new->setEtat($etat);
        
        $em->persist($new);
        $em->flush();

        return new JsonResponse(['isFavorite' => true]);
    }

    #[Route('/toggle/product/{id}', name: 'toggle_product', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    public function toggleProduct(Products $product, EntityManagerInterface $em, WishlistRepository $repo, EtatRepository $etatRepo): JsonResponse 
    {
        $user = $this->getUser();
        $item = $repo->findOneBy(['user' => $user, 'product' => $product]);

        if ($item) {
            $em->remove($item);
            $em->flush();
            return new JsonResponse(['isFavorite' => false]);
        }

        $etat = $etatRepo->findOneBy(['label' => 'Favoris']);
        
        if (!$etat) {
            return new JsonResponse(['error' => 'État Favoris non trouvé'], Response::HTTP_INTERNAL_SERVER_ERROR);
        }

        $new = new Wishlist();
        $new->setUser($user);
        $new->setProduct($product);
        $new->setEtat($etat);
        
        $em->persist($new);
        $em->flush();

        return new JsonResponse(['isFavorite' => true]);
    }
}