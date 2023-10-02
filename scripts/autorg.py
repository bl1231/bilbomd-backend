"""
Simple python jiffy to calculate the min and max Rg values
"""
import argparse
import bioxtasraw.RAWAPI as raw


def parse_args():
    parser = argparse.ArgumentParser(
        description="Calculate min and max Rg values")
    parser.add_argument("file_path", type=str, help="Path to the data file")
    return parser.parse_args()


def calculate_rg(file_path):
    profiles = raw.load_profiles(file_path)
    gi_profile = profiles[0]
    guinier_results = raw.auto_guinier(gi_profile)
    (rg, izero, rg_err, izero_err, qmin, qmax, qrg_min,
     qrg_max, idx_min, idx_max, r_sqr) = guinier_results

    rg_min = round(rg * 0.8)
    rg_max = round(rg * 1.5)

    print(f"Rg: {round(rg)}")
    print(f"Rg_min: {rg_min}")
    print(f"Rg_max: {rg_max}")


if __name__ == "__main__":
    args = parse_args()
    calculate_rg(args.file_path)
