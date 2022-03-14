<button id="buttonCounter"></button>
[[b= counter "#buttonCounter" "!innerText" "Click Me!" ]]
<script>
    document.querySelector("#buttonCounter").addEventListener("click", () => {
        let num = parseInt(scetch.get("counter"));
        if(isNaN(num)) num = 0;
        scetch.set("counter", num + 1)
    });
</script>