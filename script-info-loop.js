document.addEventListener("DOMContentLoaded", function () {
    const container = document.querySelector(".items");
    let animationTimeout = null;
    let currentlyPlaying = false;

    // Helfer: Zufallszahl im Bereich [min, max)
    function rand(min, max) {
        return min + Math.random() * (max - min);
    }

    function addNewItem(x, y) {
        const newItem = document.createElement("div");
        newItem.className = "item";
        newItem.style.left = `${x - 25}px`;
        newItem.style.top = `${y - 50}px`;

        // 3) Unregelmäßigkeit im Look: Rotation / Scale / Opacity
        const rotation = rand(-25, 25);   // Grad
        const scale = rand(0.85, 2.15);   // Faktor
        const opacity = rand(0.6, 1.0);   // 0..1

        // transform-origin sorgt dafür, dass es schön um die Mitte rotiert
        newItem.style.transformOrigin = "center center";
        newItem.style.transform = `rotate(${rotation}deg) scale(${scale})`;
        newItem.style.opacity = opacity;

        const img = document.createElement("img");
        img.src = `./bilder/Kieselstein-2.png`;
        newItem.appendChild(img);

        container.appendChild(newItem);
        manageItemLimit();
    }

    function manageItemLimit() {
        while (container.children.length > 500) {
            container.removeChild(container.firstChild);
        }
    }

    function startAnimation() {
        if (currentlyPlaying || container.children.length === 0) return;
        currentlyPlaying = true;

        gsap.to(".item", {
            y: 1000,
            scale: 0.5,
            opacity: 0,
            duration: 0.5,
            stagger: 0.025,
            onComplete: function () {
                this.targets().forEach((item) => {
                    if (item.parentNode) item.parentNode.removeChild(item);
                });
                currentlyPlaying = false;
            },
        });
    }

    container.addEventListener("mousemove", function (event) {
        clearTimeout(animationTimeout);
        addNewItem(event.pageX, event.pageY);
        animationTimeout = setTimeout(startAnimation, 100);
    });
});
