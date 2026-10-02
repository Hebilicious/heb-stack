use primes::smallest_factor;

#[test]
fn two_is_its_own_factor() {
    assert_eq!(smallest_factor(2), 2);
}

#[test]
fn ninety_seven_is_prime() {
    assert_eq!(smallest_factor(97), 97);
}

#[test]
fn ninety_one_is_seven_times_thirteen() {
    assert_eq!(smallest_factor(91), 7);
}

#[test]
fn the_largest_prime_below_two_to_the_fifty_third_is_prime() {
    let largest = (1_u64 << 53) - 111;
    assert_eq!(smallest_factor(largest), largest);
}
