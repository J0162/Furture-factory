filterSection("all")

function filterSection(c) {
    var x = document.getElementsByClassName("filterDiv");

    var activeButtons = document.getElementsByClassName("btn active");
    var activeButton = [];
    var displayWords = [];
    var kleurAan = false;
    var gewichtAan = false;
    for (var i = 0; i < activeButtons.length; i++) {
        var filterValue = activeButtons[i].getAttribute("data-filter");
        if (filterValue === "kleur") kleurAan = true;
        if (filterValue === "gewicht") gewichtAan = true;
        if (filterValue && filterValue !== "clear all" && filterValue !== "all" && filterValue !== "kleur" && filterValue !== "gewicht") {
            activeButton.push(filterValue);
            displayWords.push(activeButtons[i].innerText);
        }
    }

    var showAllKnop = document.querySelector('[data-filter="all"]');
    if (showAllKnop) {
        if (activeButton.length === 0) {
            showAllKnop.classList.add("active");
        } else {
            showAllKnop.classList.remove("active"); 
        }
    }

    var kleurSub = document.getElementById("kleurSubContainer");
    var gewichtSub = document.getElementById("gewichtSubContainer");
    if (kleurSub) kleurSub.style.display = kleurAan ? "block" : "none";
    if (gewichtSub) gewichtSub.style.display = gewichtAan ? "block" : "none";

    var displaytext = document.getElementById("activeFilters");
    if (displaytext) {
        if (displayWords.length > 0) {
            displaytext.innerHTML = displayWords.join("<br>");
        } else if (kleurAan || gewichtAan) {
            displaytext.innerHTML = (kleurAan ? "kleur (Maak een keuze)" : "") + (kleurAan && gewichtAan ? " & " : "") + (gewichtAan ? "Gewicht (Maak een keuze)" : "");
        } else {
            displaytext.innerHTML = "Alles";
        }
    }

for (var i = 0; i < x.length; i++) {
        w3removeClass(x[i], "show");

        var showAllBtn = document.querySelector('[data-filter="all"]');
        var showAllactive = showAllBtn && showAllBtn.classList.contains("active");
        
        if (activeButton.length === 0 || showAllactive) {
            if (activeButton.length === 0) {
            w3addClass(x[i], "show");
            }
        } else {
            var match = false;
            var kaartFilters = (x[i].getAttribute("data-filter") || "").split(" ");
            for (var j = 0; j < activeButton.length; j++) {
                if (kaartFilters.indexOf(activeButton[j]) > -1) {
                    match = true;
                    break;
                }
            }
            if (match) {
                w3addClass(x[i], "show");
            }
        }
    }
}

function w3addClass(element, name) {
    var i, arr1, arr2;
    arr1 = element.className.split(" ");
    arr2 = name.split(" ");
    for (i = 0; i < arr2.length; i++) {
        if (arr1.indexOf(arr2[i]) == -1) {
            element.className += " " + arr2[i];
        }
    }
}

function w3removeClass(element, name) {
    var i, arr1, arr2;
    arr1 = element.className.split(" ");
    arr2 = name.split(" ");
    for (i = 0; i < arr2.length; i++) {
        while (arr1.indexOf(arr2[i]) > -1) {
            arr1.splice(arr1.indexOf(arr2[i]), 1);
        }
    }
    element.className = arr1.join(" ");
}

function setupFilterButtons(containerId) {
    var btnContainer = document.getElementById(containerId);
    if (!btnContainer) return;
    var btns = btnContainer.getElementsByClassName("btn");
    for (var i = 0; i < btns.length; i++) {
        btns[i].addEventListener("click", function() {
            var filterValue = this.getAttribute("data-filter");
            if (filterValue === "clear all") {
                var allButtons = document.getElementsByClassName("btn");
                for (var j = 0; j < allButtons.length; j++) {
                    allButtons[j].classList.remove("active");
                }
                var showAllBtn = document.querySelector('[data-filter="all"]');
                if (showAllBtn) {
                    showAllBtn.classList.add("active");
                }
            }
            else if (filterValue === "all") {
                var allButtons = document.getElementsByClassName("btn");
                for (var j = 0; j < allButtons.length; j++) {
                    allButtons[j].classList.remove("active");
                }
                this.classList.add("active");
            }

            else {
                if (filterValue === "kleur" || filterValue === "gewicht") {
                    this.classList.toggle("active");
                    if (!this.classList.contains("active")) {
                        var subId = filterValue === "kleur" ? "myBtnContainerkleur" : "myBtnContainer2";
                        var subBtns = document.getElementById(subId).getElementsByClassName("btn");
                        for (var k = 0; k < subBtns.length; k++) {
                            subBtns[k].classList.remove("active");
                        }
                    }
                } else {
                    var showAllBtn = document.querySelector('[data-filter="all"]');
                    var showAllactive = showAllBtn && showAllBtn.classList.contains("active");
                    if (showAllBtn) {
                        showAllBtn.classList.remove("active");
                    }
                    this.classList.toggle("active");
                }
            }
            filterSection();
        });
    }
}

setupFilterButtons("myBtnContainer");
setupFilterButtons("myBtnContainerkleur");
setupFilterButtons("myBtnContainer2");

const BETAAL_PAGINA = "../Levering en betaling/Levering en betaling.html";

let cart = [];
try {
    cart = JSON.parse(localStorage.getItem("winkelwagen")) || [];
} catch (e) {
    cart = [];
}

const cartIcon = document.getElementById("cart-icon");
const cartModal = document.getElementById("cartModal");
const closeModal = document.getElementById("closeModal");
const cartCount = document.getElementById("cart-count");
const cartHeaderTotal = document.getElementById("cart-header-total");
const cartItemsList = document.getElementById("cart-items-list");
const cartTotalPrice = document.getElementById("cart-total-price");
const checkoutBtn = document.getElementById("checkout-btn");

function formatPrijs(bedrag) {
    return bedrag.toFixed(2).replace(".", ",");
}

function saveCart() {
    try {
        localStorage.setItem("winkelwagen", JSON.stringify(cart));
    } catch (e) {}
}

function berekenTotaal() {
    return cart.reduce((som, item) => som + item.price * item.aantal, 0);
}

function berekenAantal() {
    return cart.reduce((som, item) => som + item.aantal, 0);
}

function updateHeader() {
    cartCount.innerText = berekenAantal();
    cartHeaderTotal.innerText = formatPrijs(berekenTotaal());
}

function updateCartModal() {
    cartItemsList.innerHTML = "";
    if (cart.length === 0) {
        cartItemsList.innerHTML = "<p>Je winkelwagen is leeg.</p>";
    } else {
        cart.forEach((item, index) => {
            const row = document.createElement("div");
            row.className = "cart-item-row";
            row.innerHTML = `
                <span>${item.name}</span>
                <span class="cart-aantal">
                    <button class="aantal-btn" data-actie="min" data-index="${index}">−</button>
                    ${item.aantal}
                    <button class="aantal-btn" data-actie="plus" data-index="${index}">+</button>
                </span>
                <span>€${formatPrijs(item.price)}</span>
                <span>€${formatPrijs(item.price * item.aantal)}</span>
                <button class="aantal-btn" data-actie="verwijder" data-index="${index}" title="Verwijderen">🗑</button>
            `;
            cartItemsList.appendChild(row);
        });
    }
    cartTotalPrice.textContent = formatPrijs(berekenTotaal());
    checkoutBtn.ariaDisabled = cart.length === 0
}

function updateAlles() {
    saveCart();
    updateHeader();
    updateCartModal();
}

cartItemsList.addEventListener("click", function(event) {
    const knop = event.target.closest("button[data-actie]");
    if (!knop) return;
    const index = parseInt(knop.getAttribute("data-index"));
    const actie = knop.getAttribute("data-actie");
    if (actie === "plus") {
        cart[index].aantal++;
    } else if (actie === "min") {
        cart[index].aantal--;
        if (cart[index].aantal <= 0) cart.splice(index, 1);
    } else if (actie === "verwijder") {
        cart.splice(index, 1);
    }
    updateAlles();
});

cartIcon.addEventListener("click", function() {
    cartModal.style.display = "block";
    updateCartModal();
});

closeModal.addEventListener("click", function() {
    cartModal.style.display = "none";
});

window.addEventListener("click", function(event) {
    if (event.target === cartModal) {
        cartModal.style.display = "none";
    }
});

document.getElementById("doorgaan-shoppen").addEventListener("click", function() {
    cartModal.style.display = "none";
});

let toastTimer;
function showToast(name, price) {
    const toast = document.getElementById("toast");
    toast.innerHTML = `
        <strong>${name}</strong> (€${formatPrijs(price)}) is toegevoegd<br>
        Totaal: €${formatPrijs(berekenTotaal())}
    `;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() {
        toast.classList.remove("show");
    }, 3000);
}

const cartButtons = document.querySelectorAll(".cart-btn");
cartButtons.forEach(button => {
    button.addEventListener("click", function() {
        const name = this.getAttribute("data-name");
        const price = parseFloat(this.getAttribute("data-price"));
        const bestaand = cart.find(item => item.name === name);
        if (bestaand) {
            bestaand.aantal++;
        } else {
            cart.push({ name, price, aantal: 1 });
        }
        saveCart();
        updateHeader();
        showToast(name, price);
    });
});

checkoutBtn.addEventListener("click", function() {
    if (cart.length === 0) {
        alert("Je winkelwagen is leeg.");
        return;
    }
    saveCart();
    window.location.href = BETAAL_PAGINA;
});

updateHeader();
try {
    if (localStorage.getItem("BestellingGelukt")=== "1") {
        localStorage.removeItem("BestellingGelukt");
        document.getElementById("orderModal").style.display = "block";
    }
} catch (e) {}
    document.getElementById("orderModalSluiten").addEventListener("click", function () {
        document.getElementById("orderModal").style.display = "none";
    });
